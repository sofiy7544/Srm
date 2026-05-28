'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Briefcase, CheckSquare, KanbanSquare } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { users, type UserBriefList, type UserActivity } from '@/lib/api';
import { formatDate } from '@/lib/formatters';

interface Props {
  user: UserBriefList | null;
  onClose: () => void;
}

export function UserActivitySheet({ user, onClose }: Props) {
  const t = useTranslations('admin.activityPanel');
  const [data, setData] = useState<UserActivity | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setData(null);
      return;
    }
    setLoading(true);
    users
      .activity(user.id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <Sheet open={!!user} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[400px] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={user?.fullName ?? '?'} size="sm" />
            <div className="min-w-0">
              <h2 className="font-semibold tracking-tight2 truncate">{user?.fullName}</h2>
              <p className="text-xs text-muted-foreground truncate">{t('title')}</p>
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

        <div className="flex-1 overflow-auto p-5 space-y-5">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground">…</div>
          ) : !data ? (
            <div className="text-center text-sm text-muted-foreground">{t('empty')}</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <CounterCard
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                  label={t('deals')}
                  value={data.counts.deals}
                />
                <CounterCard
                  icon={<CheckSquare className="h-3.5 w-3.5" />}
                  label={t('tasks')}
                  value={data.counts.tasks}
                />
                <CounterCard
                  icon={<KanbanSquare className="h-3.5 w-3.5" />}
                  label={t('leads')}
                  value={data.counts.leads}
                />
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {t('recentTasks')}
                </h3>
                {data.recentTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('empty')}</p>
                ) : (
                  <div className="space-y-2">
                    {data.recentTasks.map((task) => (
                      <div key={task.id} className="surface-card p-3 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{task.title}</span>
                          <Badge
                            variant={
                              task.status === 'DONE'
                                ? 'success'
                                : task.status === 'OVERDUE'
                                  ? 'destructive'
                                  : 'warning'
                            }
                            className="text-3xs"
                          >
                            {task.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(task.dueAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CounterCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="surface-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
