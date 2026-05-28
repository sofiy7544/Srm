'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { templates as templatesApi, type TemplateRow } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useConfirm } from '@/components/ui/confirm-dialog';

const EMPTY = { name: '', language: 'ru' as 'ru' | 'uk', content: '' };

export default function TemplatesPage() {
  const t = useTranslations('templates');
  const tCommon = useTranslations('common');
  const confirm = useConfirm();
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'MANAGER';

  function reload() {
    templatesApi.list().then(setItems);
  }
  useEffect(reload, []);

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await templatesApi.update(editing.id, draft);
      } else {
        await templatesApi.create(draft);
      }
      setEditing(null);
      setDraft(EMPTY);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({ title: t('confirmDelete'), destructive: true });
    if (!ok) return;
    await templatesApi.remove(id);
    reload();
  }

  function openEdit(tpl: TemplateRow) {
    setEditing(tpl);
    setDraft({ name: tpl.name, language: tpl.language, content: tpl.content });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {isAdmin && !editing && (
          <Button
            onClick={() => {
              setEditing({ id: '', name: '', language: 'ru', content: '', isActive: true, createdAt: '', updatedAt: '' });
              setDraft(EMPTY);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('addNew')}
          </Button>
        )}
      </div>

      {isAdmin && editing && (
        <Card>
          <CardHeader>
            <CardTitle>{editing.id ? t('editTitle') : t('newTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('name')} *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('language')}</Label>
                <Select
                  value={draft.language}
                  onValueChange={(v) => setDraft({ ...draft, language: v as 'ru' | 'uk' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="uk">Українська</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('content')} *</Label>
              <Textarea
                rows={10}
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t('contentHint')}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setDraft(EMPTY);
                }}
              >
                {tCommon('cancel')}
              </Button>
              <Button onClick={save} disabled={saving || !draft.name.trim() || !draft.content.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t('empty')}</Card>
      ) : (
        <div className="grid gap-3">
          {items.map((tpl) => (
            <Card key={tpl.id} className="p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{tpl.name}</span>
                    <Badge variant="outline">{tpl.language === 'ru' ? 'RU' : 'UA'}</Badge>
                    {!tpl.isActive && <Badge variant="secondary">{t('inactive')}</Badge>}
                  </div>
                  <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap font-mono line-clamp-3">
                    {stripHtml(tpl.content)}
                  </pre>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(tpl)}>
                      {tCommon('edit')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => remove(tpl.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
