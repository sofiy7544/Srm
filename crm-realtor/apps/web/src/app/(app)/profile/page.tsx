'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Lock, Save, User as UserIcon } from 'lucide-react';
import { auth, users as usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { localeNames, type Locale } from '@/i18n/config';
import { PageSkeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type Me = Awaited<ReturnType<typeof auth.me>>;

const KNOWN_ROLES = new Set(['ADMIN', 'MANAGER', 'EMPLOYEE', 'REALTOR', 'ASSISTANT', 'ANALYST']);

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const tRoles = useTranslations('admin.roles');

  const [me, setMe] = useState<Me | null>(null);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    auth
      .me()
      .then((data) => {
        setMe(data);
        setFullName(data.fullName);
        setPhone(data.phone ?? '');
        setLocale((data.locale as Locale) ?? 'en');
      })
      .catch(() => undefined);
  }, []);

  if (!me) return <PageSkeleton variant="detail" />;

  const roleLabel = KNOWN_ROLES.has(me.role) ? tRoles(me.role as 'ADMIN') : me.role;

  const profileDirty =
    fullName.trim() !== me.fullName ||
    (phone.trim() || null) !== (me.phone ?? null) ||
    locale !== (me.locale as Locale);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !profileDirty) return;
    setSavingProfile(true);
    try {
      await usersApi.update(me.id, {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        locale,
      });
      const fresh = await auth.me();
      setMe(fresh);
      toast.success(t('saved'));
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? t('saveError'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    if (newPassword.length < 8) {
      toast.error(t('password.tooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('password.mismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      await usersApi.resetPassword(me.id, { oldPassword, newPassword });
      toast.success(t('password.changed'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? t('password.error'));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 animate-slide-up">
      <div>
        <h1 className="heading-page">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* ── Editable profile data ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            {t('personalInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">{t('fullName')} *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" value={me.email} disabled className="text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">{t('phone')}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  maxLength={40}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="locale">{t('locale')}</Label>
                <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                  <SelectTrigger id="locale">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(localeNames) as [Locale, string][]).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('role')}</Label>
                <Input value={roleLabel} disabled className="text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('createdAt')}</Label>
                <Input
                  value={new Date(me.createdAt).toLocaleDateString(locale)}
                  disabled
                  className="text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={savingProfile || !profileDirty}>
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {tCommon('save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Change password ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            {t('password.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="oldPassword">{t('password.old')} *</Label>
              <Input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">{t('password.new')} *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="text-3xs text-muted-foreground">{t('password.hint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{t('password.confirm')} *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={
                  savingPassword ||
                  !oldPassword ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
              >
                {savingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {t('password.change')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
