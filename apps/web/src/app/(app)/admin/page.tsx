'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Activity as ActivityIcon,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  users,
  type UserBriefList,
  type CreateUserPayload,
  type UpdateUserPayload,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { UserFormSheet } from '@/components/admin/user-form-sheet';
import { ResetPasswordDialog } from '@/components/admin/reset-password-dialog';
import { UserActivitySheet } from '@/components/admin/user-activity-sheet';
import { useConfirm } from '@/components/ui/confirm-dialog';

const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'REALTOR', 'ASSISTANT', 'ANALYST'] as const;
const ALL = '__ALL__';
type StatusFilter = 'all' | 'active' | 'inactive';

const ROLE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'secondary'> = {
  ADMIN: 'warning',
  MANAGER: 'default',
  EMPLOYEE: 'success',
  REALTOR: 'secondary',
  ASSISTANT: 'secondary',
  ANALYST: 'secondary',
};

export default function AdminPage() {
  const t = useTranslations('admin');
  const me = useAuthStore((s) => s.user);
  const router = useRouter();
  const confirm = useConfirm();

  const [list, setList] = useState<UserBriefList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserBriefList | null>(null);

  const [resetFor, setResetFor] = useState<UserBriefList | null>(null);
  const [activityFor, setActivityFor] = useState<UserBriefList | null>(null);

  // Гард: если зашёл не админ, перенаправляем на /dashboard.
  // Middleware пускает по факту наличия cookie, тонкий контроль роли — здесь.
  useEffect(() => {
    if (me && me.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [me, router]);

  function reload() {
    setLoading(true);
    users
      .list()
      .then(setList)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((u) => {
      if (roleFilter !== ALL && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [list, search, roleFilter, statusFilter]);

  async function onCreate(input: CreateUserPayload) {
    await users.create(input);
    setFormOpen(false);
    reload();
  }

  async function onUpdate(id: string, input: UpdateUserPayload) {
    await users.update(id, input);
    setFormOpen(false);
    setEditing(null);
    reload();
  }

  async function toggleActive(u: UserBriefList) {
    const msg = u.isActive
      ? t('actions.confirmDeactivate', { name: u.fullName })
      : t('actions.confirmActivate', { name: u.fullName });
    const ok = await confirm({
      title: msg,
      destructive: u.isActive,
    });
    if (!ok) return;
    if (u.isActive) await users.deactivate(u.id);
    else await users.activate(u.id);
    reload();
  }

  if (me && me.role !== 'ADMIN') {
    return (
      <div className="text-sm text-muted-foreground">Доступ только для администратора.</div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')} · {t('total', { count: list.length })}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t('addUser')}
        </Button>
      </div>

      {/* Описание ролей — карточки */}
      <div className="grid sm:grid-cols-3 gap-3">
        {(['ADMIN', 'MANAGER', 'EMPLOYEE'] as const).map((r) => (
          <Card key={r} className="p-4">
            <div className="flex items-center gap-2">
              <Badge variant={ROLE_VARIANT[r]}>{t(`roles.${r}`)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {t(`rolesDescription.${r}`)}
            </p>
          </Card>
        ))}
      </div>

      {/* Тулбар фильтров */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="h-9 pl-8 w-[240px]"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-9 min-w-[160px]">
            <SelectValue placeholder={t('filterRole')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filterRole')}</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`roles.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 p-1 surface-card rounded-xl">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium tracking-tightish transition-all whitespace-nowrap',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-foreground/70 hover:bg-muted hover:text-foreground',
              )}
            >
              {t(`filterStatus.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto animate-spin opacity-60" />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">{t('empty')}</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 font-medium">{t('table.name')}</th>
                <th className="px-4 py-3 font-medium">{t('table.role')}</th>
                <th className="px-4 py-3 font-medium">{t('table.manager')}</th>
                <th className="px-4 py-3 font-medium">{t('table.status')}</th>
                <th className="px-4 py-3 font-medium">{t('table.lastLogin')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    'border-b last:border-b-0 transition-colors hover:bg-muted/40',
                    !u.isActive && 'opacity-60',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={u.fullName} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium tracking-tightish truncate">{u.fullName}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_VARIANT[u.role] ?? 'secondary'}>
                      {t(`roles.${u.role}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.manager ? u.manager.fullName : t('table.noManager')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? 'success' : 'destructive'}>
                      {u.isActive ? t('table.active') : t('table.inactive')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString('ru-RU', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : t('table.never')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <IconBtn
                        title={t('actions.viewActivity')}
                        onClick={() => setActivityFor(u)}
                      >
                        <ActivityIcon className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        title={t('actions.resetPassword')}
                        onClick={() => setResetFor(u)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        title={u.isActive ? t('actions.deactivate') : t('actions.activate')}
                        onClick={() => toggleActive(u)}
                      >
                        {u.isActive ? (
                          <ShieldOff className="h-3.5 w-3.5 text-danger" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </IconBtn>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(u);
                          setFormOpen(true);
                        }}
                      >
                        {t('actions.edit')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <UserFormSheet
        open={formOpen}
        editing={editing}
        managers={list.filter((u) => u.role === 'ADMIN' || u.role === 'MANAGER')}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />

      <ResetPasswordDialog
        user={resetFor}
        onClose={() => setResetFor(null)}
      />

      <UserActivitySheet
        user={activityFor}
        onClose={() => setActivityFor(null)}
      />
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}
