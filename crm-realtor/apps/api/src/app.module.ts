import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { ClientsModule } from './modules/clients/clients.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { SourcesModule } from './modules/sources/sources.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { LeadsModule } from './modules/leads/leads.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ShowingsModule } from './modules/showings/showings.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { EmailModule } from './services/email/email.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { QueueModule } from './modules/queue/queue.module';
import { AutomationModule } from './modules/automation/automation.module';
import { DealsModule } from './modules/deals/deals.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MessagesModule } from './modules/messages/messages.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'auth', ttl: 60_000, limit: 30 },
      { name: 'webhook', ttl: 60_000, limit: 60 },
    ]),
    PrismaModule,
    AuditModule,
    AiModule,
    QueueModule,
    TelegramModule,
    EmailModule,
    TemplatesModule,
    NotificationsModule,
    AutomationModule,
    AuthModule,
    UsersModule,
    HealthModule,
    ClientsModule,
    PropertiesModule,
    SourcesModule,
    UploadsModule,
    LeadsModule,
    TasksModule,
    ShowingsModule,
    ActivitiesModule,
    WebhooksModule,
    DealsModule,
    DocumentsModule,
    ReportsModule,
    MessagesModule,
    InvitationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
