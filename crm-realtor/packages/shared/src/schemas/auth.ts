import { z } from 'zod';
import { UserRole, Locale } from '../enums';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(32).optional(),
  role: z.nativeEnum(UserRole).default(UserRole.REALTOR),
  locale: z.nativeEnum(Locale).default(Locale.UK),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(256),
  password: z.string().min(8).max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(10).max(256),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(UserRole).default(UserRole.REALTOR),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(10).max(256),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(32).optional(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
