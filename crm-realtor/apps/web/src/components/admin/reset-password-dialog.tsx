'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check, X, KeyRound, Loader2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { users, type UserBriefList } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  user: UserBriefList | null;
  onClose: () => void;
}

export function ResetPasswordDialog({ user, onClose }: Props) {
  const t = useTranslations('admin.passwordReset');
  const [mode, setMode] = useState<'generate' | 'manual'>('generate');
  const [manualPwd, setManualPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Сброс состояния при открытии нового user.
  useEffect(() => {
    if (user) {
      setMode('generate');
      setManualPwd('');
      setGeneratedPwd(null);
      setCopied(false);
    }
  }, [user]);

  async function onSubmit() {
    if (!user) return;
    setBusy(true);
    try {
      const res = await users.resetPassword(user.id, {
        newPassword: mode === 'manual' ? manualPwd : undefined,
      });
      if (mode === 'generate' && res.password) {
        setGeneratedPwd(res.password);
      } else {
        // Ручной — сохраняем для показа подтверждения
        setGeneratedPwd(manualPwd);
      }
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  }

  return (
    <Sheet open={!!user} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" title="Сброс пароля" className="w-full sm:w-[400px] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold tracking-tight2 truncate">{t('trigger')}</h2>
              <p className="text-xs text-muted-foreground truncate">{user?.fullName}</p>
            </div>
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

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {!generatedPwd ? (
            <>
              <div className="flex gap-1 p-1 surface-card rounded-xl">
                <ModeBtn label={t('generateNew')} active={mode === 'generate'} onClick={() => setMode('generate')} />
                <ModeBtn label={t('setNew')} active={mode === 'manual'} onClick={() => setMode('manual')} />
              </div>

              {mode === 'manual' && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('newPasswordPlaceholder')}
                  </Label>
                  <Input
                    type="text"
                    value={manualPwd}
                    onChange={(e) => setManualPwd(e.target.value)}
                    minLength={8}
                    placeholder="••••••••"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('description')}</p>
              <div className="surface-card p-4 flex items-center gap-2">
                <code className="flex-1 font-mono text-base tabular-nums tracking-tight break-all">
                  {generatedPwd}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generatedPwd)}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t('copied') : t('copy')}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4 flex items-center justify-end gap-2">
          {!generatedPwd ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('close')}
              </Button>
              <Button type="button" onClick={onSubmit} disabled={busy || (mode === 'manual' && manualPwd.length < 8)}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('trigger')}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onClose}>
              {t('close')}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ModeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-lg px-3 py-1.5 text-xs font-medium tracking-tightish transition-all flex-1 ' +
        (active
          ? 'bg-primary text-primary-foreground shadow-glow'
          : 'text-foreground/70 hover:bg-muted hover:text-foreground')
      }
    >
      {label}
    </button>
  );
}
