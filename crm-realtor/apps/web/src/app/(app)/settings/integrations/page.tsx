'use client';

import { useTranslations } from 'next-intl';
import {
  CheckCircle2, XCircle, Send, Mail, Facebook, MessageSquare, MessageCircle,
  Sparkles, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Status = 'ready' | 'connected' | 'not-configured' | 'coming-soon';

function StatusBadge({ status }: { status: Status }) {
  if (status === 'connected') return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> підключено</Badge>;
  if (status === 'ready')      return <Badge variant="warning" className="gap-1"><Sparkles className="h-3 w-3" /> готово до підключення</Badge>;
  if (status === 'coming-soon') return <Badge variant="secondary" className="gap-1">скоро</Badge>;
  return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> не налаштовано</Badge>;
}

export default function IntegrationsPage() {
  const t = useTranslations('integrations');

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="heading-page">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* ── Lead-capture channels ─────────────────────────────────── */}
      <div className="pt-2">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Канали входу лідів
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <MessageCircle className="h-5 w-5 text-sky-500" />
            Telegram-канал
            <StatusBadge status="ready" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Автоматичний імпорт лідів з вашого Telegram-каналу. Кожне нове повідомлення стає лідом в CRM
            і потрапляє в «Пул» для розподілу.
          </p>
          <p className="text-muted-foreground">
            Підходить для агентств, що ведуть рекламу через Facebook/Instagram з відповідями в Telegram.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Створити бота через <code className="bg-muted px-1 rounded">@BotFather</code></li>
            <li>Додати бота в канал як адміна (читати повідомлення)</li>
            <li>Вставити токен і ID каналу в форму нижче</li>
          </ol>
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" disabled>
              Підключити канал <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground self-center">потрібен токен бота і ID каналу</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            WhatsApp Business Cloud API
            <StatusBadge status="ready" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Повна двостороння інтеграція з WhatsApp через Meta Business Cloud. Усі вхідні
            автоматично створюють лідів, відповіді з CRM летять у WhatsApp клієнта.
          </p>
          <p className="text-muted-foreground">
            Поточно: deeplink (відкрити чат WhatsApp з номером клієнта). Cloud API — готовий до активації.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Створити Meta Business Account і WhatsApp Business App</li>
            <li>Отримати Phone Number ID + System User Access Token</li>
            <li>Налаштувати webhook URL: <code className="bg-muted px-1 rounded">/api/webhooks/whatsapp</code></li>
            <li>Затвердження Meta — 1-2 тижні</li>
          </ol>
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" disabled>
              Connect with Meta <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground self-center">потрібен Meta Business Account</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Facebook className="h-5 w-5 text-blue-600" />
            Facebook &amp; Instagram Lead Ads
            <StatusBadge status="ready" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('metaDescription')}</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Створити Meta App в <a className="text-primary underline" href="https://developers.facebook.com" target="_blank" rel="noreferrer">developers.facebook.com</a> з продуктом Webhooks</li>
            <li>В <code className="bg-muted px-1 rounded">.env</code> встановити META_APP_ID, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN</li>
            <li>Вказати URL вебхука: <code className="bg-muted px-1 rounded">/api/webhooks/meta</code></li>
          </ol>
          <p className="text-xs text-muted-foreground pt-1">
            Після підключення нові ліди з форм FB/Instagram автоматично зʼявляються в «Пулі».
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Mail className="h-5 w-5 text-violet-500" />
            Email (SMTP)
            <StatusBadge status="not-configured" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('smtpDescription')}</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Отримати SMTP-дані у провайдера (Resend, Mailgun, власний сервер)</li>
            <li>Заповнити в <code className="bg-muted px-1 rounded">.env</code>: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM</li>
            <li>Перезапустити API. Шаблони редагуються в розділі «Шаблони повідомлень»</li>
          </ol>
        </CardContent>
      </Card>

      {/* ── Notifications channel ─────────────────────────────────── */}
      <div className="pt-4">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Канали сповіщень
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Send className="h-5 w-5 text-sky-500" />
            Telegram-бот (для агентів)
            <StatusBadge status="not-configured" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('telegramDescription')}</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Створити бота через <code className="bg-muted px-1 rounded">@BotFather</code>, отримати токен</li>
            <li>Додати <code className="bg-muted px-1 rounded">TELEGRAM_BOT_TOKEN=...</code> в <code className="bg-muted px-1 rounded">.env</code> і перезапустити API</li>
            <li>Кожен агент пише боту <code className="bg-muted px-1 rounded">/start</code>, отримує chat_id у профіль</li>
          </ol>
        </CardContent>
      </Card>

      {/* ── AI ─────────────────────────────────────────────────────── */}
      <div className="pt-4">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          AI помічники
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-5 w-5 text-violet-500" />
            AI Briefing на старті дня
            <StatusBadge status="coming-soon" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Кожного ранку OpenAI / Claude аналізує ваших лідів і пропонує: «Почніть з цих 3 — найбільший шанс закриття сьогодні».
          </p>
          <p className="text-xs text-muted-foreground">
            Підключення Anthropic / OpenAI API ключа. Дані лідів не виходять за межі вашого сервера.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
