/**
 * Compatibility re-export. The real implementation now lives in
 * `services/email`. This shim keeps the old import paths
 * (`modules/email/email.service`) working for existing callers
 * (clients, automation, presentation modules).
 */
export { EmailService } from '../../services/email/email.service';
