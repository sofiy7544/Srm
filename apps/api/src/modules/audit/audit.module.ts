import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Global модуль: AuditService доступен везде без явного импорта.
 * Это упрощает интеграцию в существующие сервисы — добавил DI и используй.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
