'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Loader2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserBriefList, CreateUserPayload, UpdateUserPayload } from '@/lib/api';

const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
const NO_MANAGER = '__NONE__';

interface UserFormSheetProps {
  open: boolean;
  editing: UserBriefList | null;
  managers: UserBriefList[];
  onClose: () => void;
  onCreate: (input: CreateUserPayload) => Promise<void>;
  onUpdate: (id: string, input: UpdateUserPayload) => Promise<void>;
}

export function UserFormSheet({
  open,
  editing,
  managers,
  onClose,
  onCreate,
  onUpdate,
}: UserFormSheetProps) {
  const t = useTranslations('admin');
  const isEdit = !!editing;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('EMPLOYEE');
  const [managerId, setManagerId] = useState<string>(NO_MANAGER);
  const [locale, setLocale] = useState<string>('ru');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setFullName(editing.fullName);
      setEmail(editing.email);
      setPhone(editing.phone ?? '');
      setPassword('');
      setRole(editing.role);
      setManagerId(editing.managerId ?? NO_MANAGER);
      setLocale(editing.locale ?? 'ru');
      setIsActive(editing.isActive);
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setRole('EMPLOYEE');
      setManagerId(NO_MANAGER);
      setLocale('ru');
      setIsActive(true);
    }
    setError(null);
  }, [open, editing]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const managerIdValue = managerId === NO_MANAGER ? null : managerId;
      if (isEdit && editing) {
        await onUpdate(editing.id, {
          fullName,
          phone: phone || null,
          role,
          managerId: managerIdValue,
          locale,
          isActive,
        });
      } else {
        if (password.length < 8) {
          setError(t('form.passwordHint'));
          setBusy(false);
          return;
        }
        await onCreate({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone || undefined,
          role,
          managerId: managerIdValue,
          locale,
        });
      }
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[420px] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-semibold tracking-tight2">
              {isEdit ? t('form.editTitle') : t('form.createTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto p-5 space-y-4">
            <Field label={t('form.fullName')} required>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>

            <Field label={t('form.email')} required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isEdit}
              />
            </Field>

            <Field label={t('form.phone')}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333 1234567" />
            </Field>

            {!isEdit && (
              <Field label={t('form.password')} required hint={t('form.passwordHint')}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </Field>
            )}

            <Field label={t('form.role')}>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`roles.${r}`)}
                    </SelectItem>
                  ))}
                  {isEdit && editing && !ROLES.includes(editing.role as (typeof ROLES)[number]) && (
                    <SelectItem value={editing.role}>{t(`roles.${editing.role}`)}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t('form.manager')}>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER}>{t('form.managerNone')}</SelectItem>
                  {managers
                    .filter((m) => !editing || m.id !== editing.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.fullName} · {t(`roles.${m.role}`)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t('form.locale')}>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="uk">Українська</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {isEdit && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>{t('form.isActive')}</span>
              </label>
            )}

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="border-t p-4 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('form.save')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label} {required && '*'}
      </Label>
      {children}
      {hint && <p className="text-2xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
