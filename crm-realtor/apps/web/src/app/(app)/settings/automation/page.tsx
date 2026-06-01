'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Trash2, Zap, ZapOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  automationRules,
  users as usersApi,
  templates as templatesApi,
  type AutomationRuleRow,
  type UserBriefList,
  type TemplateRow,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useConfirm } from '@/components/ui/confirm-dialog';

type RuleMode = 'ROUND_ROBIN' | 'FIXED' | 'WELCOME_EMAIL' | 'SCHEDULE_FOLLOWUP';

const MODE_LABEL: Record<RuleMode, string> = {
  ROUND_ROBIN: 'Round-robin (по очереди)',
  FIXED: 'Конкретному риелтору',
  WELCOME_EMAIL: 'Авто-приветствие email',
  SCHEDULE_FOLLOWUP: 'Напоминание follow-up',
};

export default function AutomationPage() {
  const t = useTranslations('automation');
  const tCommon = useTranslations('common');
  const confirm = useConfirm();
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'MANAGER';

  const [rules, setRules] = useState<AutomationRuleRow[]>([]);
  const [usersList, setUsersList] = useState<UserBriefList[]>([]);
  const [templatesList, setTemplatesList] = useState<TemplateRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    mode: 'ROUND_ROBIN' as RuleMode,
    userId: '',
    templateId: '',
    subject: '',
    days: 3,
    title: '',
    priority: 100,
    // condition fields (engine reads cond.sourceType, cond.district, cond.dealIntent)
    condSourceType: '',
    condDistrict: '',
    condDealIntent: '' as '' | 'BUY' | 'RENT',
  });
  const [saving, setSaving] = useState(false);

  function reload() {
    automationRules.list().then(setRules);
  }
  useEffect(() => {
    reload();
    usersApi.list().then(setUsersList).catch(() => undefined);
    templatesApi.list().then(setTemplatesList).catch(() => undefined);
  }, []);

  async function toggle(rule: AutomationRuleRow) {
    await automationRules.update(rule.id, { isActive: !rule.isActive });
    reload();
  }

  async function remove(id: string) {
    const ok = await confirm({ title: t('confirmDelete'), destructive: true });
    if (!ok) return;
    await automationRules.remove(id);
    reload();
  }

  async function save() {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const action: Record<string, unknown> = { mode: draft.mode };
      if (draft.mode === 'FIXED') action.userId = draft.userId;
      if (draft.mode === 'WELCOME_EMAIL') {
        action.templateId = draft.templateId;
        action.subject = draft.subject;
      }
      if (draft.mode === 'SCHEDULE_FOLLOWUP') {
        action.days = draft.days;
        action.title = draft.title || `Связаться с клиентом (через ${draft.days} дн.)`;
      }
      const condition: Record<string, unknown> = {};
      if (draft.condSourceType) condition.sourceType = draft.condSourceType;
      if (draft.condDistrict.trim()) condition.district = draft.condDistrict.trim();
      if (draft.condDealIntent) condition.dealIntent = draft.condDealIntent;
      await automationRules.create({
        name: draft.name.trim(),
        condition,
        action,
        priority: draft.priority,
        isActive: true,
      });
      setDraft({
        name: '',
        mode: 'ROUND_ROBIN',
        userId: '',
        templateId: '',
        subject: '',
        days: 3,
        title: '',
        priority: 100,
        condSourceType: '',
        condDistrict: '',
        condDealIntent: '',
      });
      setCreating(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {isAdmin && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t('addNew')}
          </Button>
        )}
      </div>

      {isAdmin && creating && (
        <Card>
          <CardHeader>
            <CardTitle>{t('newTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('ruleName')} *</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>{t('mode')}</Label>
                <Select
                  value={draft.mode}
                  onValueChange={(v) => setDraft({ ...draft, mode: v as RuleMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(MODE_LABEL) as [RuleMode, string][]).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {draft.mode === 'FIXED' && (
              <div className="space-y-1">
                <Label>{t('user')}</Label>
                <Select value={draft.userId} onValueChange={(v) => setDraft({ ...draft, userId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersList
                      .filter((u) => u.isActive && (u.role === 'REALTOR' || u.role === 'ASSISTANT'))
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {draft.mode === 'WELCOME_EMAIL' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t('template')}</Label>
                  <Select
                    value={draft.templateId}
                    onValueChange={(v) => setDraft({ ...draft, templateId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesList.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t('subject')}</Label>
                  <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                </div>
              </div>
            )}

            {draft.mode === 'SCHEDULE_FOLLOWUP' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t('daysLater')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={draft.days}
                    onChange={(e) => setDraft({ ...draft, days: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('taskTitle')}</Label>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
              </div>
            )}

            {/* Conditions — engine reads cond.sourceType, cond.district, cond.dealIntent */}
            <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Умова спрацювання (необов&#39;язково)
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Тип джерела</Label>
                  <Select
                    value={draft.condSourceType || '__ANY__'}
                    onValueChange={(v) => setDraft({ ...draft, condSourceType: v === '__ANY__' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ANY__">— Будь-яке —</SelectItem>
                      <SelectItem value="FB_LEAD_ADS">Facebook Ads</SelectItem>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="TELEGRAM">Telegram</SelectItem>
                      <SelectItem value="WEBSITE">Сайт</SelectItem>
                      <SelectItem value="REFERRAL">Реферал</SelectItem>
                      <SelectItem value="MANUAL">Ручне</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Призначення</Label>
                  <Select
                    value={draft.condDealIntent || '__ANY__'}
                    onValueChange={(v) => setDraft({ ...draft, condDealIntent: (v === '__ANY__' ? '' : v) as '' | 'BUY' | 'RENT' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ANY__">— Будь-яке —</SelectItem>
                      <SelectItem value="BUY">Продаж</SelectItem>
                      <SelectItem value="RENT">Оренда</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Район (містить)</Label>
                  <Input
                    value={draft.condDistrict}
                    onChange={(e) => setDraft({ ...draft, condDistrict: e.target.value })}
                    placeholder="Centro / Brera / 7th arr.…"
                  />
                </div>
              </div>
              <p className="text-3xs text-muted-foreground">
                Правило спрацьовує лише коли всі задані поля збігаються з лідом. Залишіть порожнім для «спрацьовує завжди».
              </p>
            </div>

            <div className="space-y-1 max-w-xs">
              <Label>{t('priority')}</Label>
              <Input
                type="number"
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">{t('priorityHint')}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={save} disabled={saving || !draft.name.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rules.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t('empty')}</Card>
      ) : (
        <div className="grid gap-2">
          {rules.map((r) => {
            const mode = (r.action.mode as RuleMode) ?? 'ROUND_ROBIN';
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.isActive ? (
                        <Zap className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <ZapOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold">{r.name}</span>
                      <Badge variant="outline">{MODE_LABEL[mode] ?? mode}</Badge>
                      <Badge variant="secondary" className="text-xs">
                        {t('priorityLabel')}: {r.priority}
                      </Badge>
                      {!r.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          {t('inactive')}
                        </Badge>
                      )}
                    </div>
                    <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(r.action, null, 0)}
                    </pre>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => toggle(r)}>
                        {r.isActive ? t('disable') : t('enable')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4 bg-muted/30 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">{t('howItWorks')}</p>
        <ul className="list-disc list-inside space-y-1">
          <li>{t('hint1')}</li>
          <li>{t('hint2')}</li>
          <li>{t('hint3')}</li>
        </ul>
      </Card>
    </div>
  );
}
