import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { UserRole, Locale } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { UsersService } from './users.service';

const roleEnum = z.nativeEnum(UserRole);
const localeEnum = z.nativeEnum(Locale);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  fullName: z.string().min(1).max(120),
  phone: z.string().max(40).optional(),
  role: roleEnum.optional(),
  managerId: z.string().uuid().optional().nullable(),
  locale: localeEnum.optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  role: roleEnum.optional(),
  managerId: z.string().uuid().nullable().optional(),
  locale: localeEnum.optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(100).optional(),
  oldPassword: z.string().min(1).max(100).optional(),
});

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.users.findById(user.userId);
  }

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.users.list({ id: user.userId, role: user.role });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Get(':id/activity')
  activity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.users.activity({ id: user.userId, role: user.role }, id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createUserSchema)) body: z.infer<typeof createUserSchema>,
  ) {
    return this.users.create({ id: user.userId, role: user.role }, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: z.infer<typeof updateUserSchema>,
  ) {
    return this.users.update({ id: user.userId, role: user.role }, id, body);
  }

  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>,
  ) {
    return this.users.resetPassword({ id: user.userId, role: user.role }, id, body);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN)
  activate(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.users.activate({ id: user.userId, role: user.role }, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  deactivate(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.users.deactivate({ role: user.role, id: user.userId }, id);
  }
}
