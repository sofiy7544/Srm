import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { InvitationStatus, UserRole, Locale } from '@prisma/client';
import { EmailService } from '../../services/email/email.service';
import { EmailTokenService } from '../../services/email/email-token.service';
import { EmailConfig } from '../../services/email/email.config';

/**
 * Team Invitations — invite a colleague by email, they accept by setting
 * a password through a single-use token.
 *
 * Tokens are stored hashed; the plaintext only ever lives in the email
 * delivered to the invitee.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly tokens: EmailTokenService,
    private readonly emailConfig: EmailConfig,
  ) {}

  async invite(
    inviterId: string,
    inviterName: string,
    inviterEmail: string,
    inviteeEmail: string,
    role: UserRole,
  ) {
    const normalizedEmail = inviteeEmail.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Revoke any prior pending invitations for the same address.
    await this.prisma.teamInvitation.updateMany({
      where: { email: normalizedEmail, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.REVOKED },
    });

    const plain = this.tokens.generate();
    const tokenHash = this.tokens.hash(plain);
    const expiresAt = new Date(
      Date.now() + this.emailConfig.inviteTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.prisma.teamInvitation.create({
      data: {
        email: normalizedEmail,
        role,
        tokenHash,
        invitedById: inviterId,
        expiresAt,
      },
    });

    const acceptUrl = `${this.emailConfig.appUrl}/auth/accept-invitation?token=${encodeURIComponent(plain)}`;

    void this.email.sendTemplate({
      to: normalizedEmail,
      template: 'team-invitation',
      variables: {
        inviterName,
        inviterEmail,
        inviteeEmail: normalizedEmail,
        role,
        acceptUrl,
        expiresInDays: this.emailConfig.inviteTokenTtlDays,
      },
      metadata: { invitationId: invitation.id, role },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  async list() {
    const rows = await this.prisma.teamInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      status: this.effectiveStatus(r.status, r.expiresAt),
      invitedBy: r.invitedBy,
      expiresAt: r.expiresAt,
      acceptedAt: r.acceptedAt,
      createdAt: r.createdAt,
    }));
  }

  async revoke(id: string) {
    const inv = await this.prisma.teamInvitation.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Cannot revoke invitation in status ${inv.status}`);
    }
    await this.prisma.teamInvitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED },
    });
    return { ok: true };
  }

  /** Used by the public accept-invitation endpoint. */
  async accept(input: {
    token: string;
    password: string;
    fullName: string;
    phone?: string;
  }) {
    const tokenHash = this.tokens.hash(input.token);
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation has already been used or revoked');
    }
    if (invitation.expiresAt < new Date()) {
      // Mark as expired for clean status tracking.
      await this.prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException('Invalid or expired invitation');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          fullName: input.fullName,
          phone: input.phone,
          role: invitation.role,
          locale: Locale.ru,
          // Accepting an invitation implicitly verifies the email — the user
          // had to receive the message and click the unique link.
          emailVerifiedAt: new Date(),
        },
      });
      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      });
      return created;
    });

    return { id: user.id, email: user.email, role: user.role };
  }

  private effectiveStatus(stored: InvitationStatus, expiresAt: Date): InvitationStatus {
    if (stored === InvitationStatus.PENDING && expiresAt < new Date()) {
      return InvitationStatus.EXPIRED;
    }
    return stored;
  }
}
