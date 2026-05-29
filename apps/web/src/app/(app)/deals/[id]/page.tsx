'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, FileText, Plus, Printer, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  deals,
  payments,
  documents,
  templates as templatesApi,
  type DealRow,
  type DocumentRow,
  type PaymentRow,
  type TemplateRow,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate, formatPrice } from '@/lib/formatters';
import { useConfirm } from '@/components/ui/confirm-dialog';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive'> = {
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};

const DOC_TYPES = ['PASSPORT', 'CONTRACT', 'RECEIPT', 'OTHER'];

export default function DealDetailPage() {
  const t = useTranslations('deals');
  const tCommon = useTranslations('common');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const askConfirm = useConfirm();
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'MANAGER';

  const [deal, setDeal] = useState<DealRow | null>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [paysList, setPays] = useState<PaymentRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [addingPayment, setAddingPayment] = useState(false);
  const [uploadingType, setUploadingType] = useState('CONTRACT');
  const [contractTplId, setContractTplId] = useState('');

  function reload() {
    if (!params.id) return;
    deals.get(params.id).then(setDeal);
    documents.list({ dealId: params.id }).then(setDocs);
    payments.byDeal(params.id).then(setPays);
  }

  useEffect(() => {
    reload();
    templatesApi.list().then(setTemplates).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function setStatus(status: 'COMPLETED' | 'CANCELLED' | 'IN_PROGRESS') {
    if (!deal) return;
    await deals.update(deal.id, { status });
    reload();
  }

  async function addPayment() {
    if (!deal || !paymentAmount) return;
    setAddingPayment(true);
    try {
      await payments.create({
        dealId: deal.id,
        amount: Number(paymentAmount),
        type: 'COMMISSION',
        paidAt: new Date().toISOString(),
        note: paymentNote || undefined,
      });
      setPaymentAmount('');
      setPaymentNote('');
      reload();
    } finally {
      setAddingPayment(false);
    }
  }

  async function removePayment(id: string) {
    await payments.remove(id);
    reload();
  }

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !deal) return;
    await documents.upload(file, {
      type: uploadingType,
      dealId: deal.id,
      clientId: deal.clientId,
    });
    e.target.value = '';
    reload();
  }

  async function removeDoc(id: string) {
    const ok = await askConfirm({ title: t('confirmRemoveDoc'), destructive: true });
    if (!ok) return;
    await documents.remove(id);
    reload();
  }

  function openContract() {
    if (!deal || !contractTplId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/contracts/deal/${deal.id}?templateId=${contractTplId}`, {
      credentials: 'include',
    })
      .then((r) => r.text())
      .then((html) => {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
        }
      });
  }

  if (!deal) return <PageSkeleton variant="detail" />;

  const paidSum = paysList.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(deal.commissionAmount) - paidSum;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/deals">
            <ArrowLeft className="h-4 w-4" />
            {t('backToList')}
          </Link>
        </Button>
        <div className="flex gap-2 flex-wrap">
          {deal.status === 'IN_PROGRESS' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStatus('COMPLETED')}>
                {t('markCompleted')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStatus('CANCELLED')}>
                {t('markCancelled')}
              </Button>
            </>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const ok = await askConfirm({ title: t('confirmDelete'), destructive: true });
                if (!ok) return;
                await deals.remove(deal.id);
                router.push('/deals');
              }}
            >
              <Trash2 className="h-4 w-4" />
              {tCommon('delete')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-2xl">{formatPrice(deal.amount)}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('commission')}: {Number(deal.commissionPercent)}% = {formatPrice(deal.commissionAmount)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant={(deal.dealIntent ?? 'BUY') === 'RENT' ? 'warning' : 'secondary'}
              >
                {(deal.dealIntent ?? 'BUY') === 'RENT' ? 'Оренда' : 'Продаж'}
              </Badge>
              <Badge variant={STATUS_VARIANT[deal.status] ?? 'secondary'}>
                {t(`statuses.${deal.status}`)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label={t('client')} value={
            <Link className="hover:underline" href={`/clients/${deal.client.id}`}>
              {deal.client.fullName} · {deal.client.primaryPhone}
            </Link>
          } />
          <Row label={t('property')} value={
            <Link className="hover:underline" href={`/properties/${deal.property.id}`}>
              {deal.property.address}
            </Link>
          } />
          <Row label={t('agent')} value={deal.agent.fullName} />
          <Row label={t('createdAt')} value={formatDate(deal.createdAt)} />
          {deal.closedAt && <Row label={t('closedAt')} value={formatDate(deal.closedAt)} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('paymentsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label={t('commissionPlan')} value={formatPrice(deal.commissionAmount)} />
            <Stat label={t('paid')} value={formatPrice(paidSum)} />
            <Stat label={t('remaining')} value={formatPrice(remaining)} highlight={remaining > 0} />
          </div>

          {isAdmin && (
            <div className="flex gap-2 items-end pt-2 border-t">
              <div className="flex-1 space-y-1">
                <Label>{t('paymentAmount')}</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label>{t('paymentNote')}</Label>
                <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
              </div>
              <Button onClick={addPayment} disabled={addingPayment || !paymentAmount}>
                <Plus className="h-4 w-4" />
                {t('addPayment')}
              </Button>
            </div>
          )}

          {paysList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
          ) : (
            <div className="space-y-1">
              {paysList.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-b py-2 last:border-0">
                  <div>
                    <span className="font-medium">{formatPrice(p.amount)}</span>
                    <span className="text-muted-foreground"> · {formatDate(p.paidAt)}</span>
                    {p.user && <span className="text-muted-foreground"> · {p.user.fullName}</span>}
                    {p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => removePayment(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('contractTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('contractHint')}</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>{t('chooseTemplate')}</Label>
              <Select value={contractTplId} onValueChange={setContractTplId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openContract} disabled={!contractTplId}>
              <Printer className="h-4 w-4" />
              {t('printContract')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('documentsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2 items-end">
            <div className="w-40 space-y-1">
              <Label>{t('docType')}</Label>
              <Select value={uploadingType} onValueChange={setUploadingType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {t(`docTypes.${tp}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" />
                {t('uploadDoc')}
                <input type="file" className="hidden" onChange={onFileSelect} />
              </label>
            </Button>
          </div>

          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noDocs')}</p>
          ) : (
            <div className="space-y-1">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-sm border-b py-2 last:border-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="hover:underline flex-1 truncate">
                    {d.originalName}
                  </a>
                  <Badge variant="outline" className="text-xs">{t(`docTypes.${d.type}`)}</Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{formatDate(d.createdAt)}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeDoc(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted-foreground min-w-[140px]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-amber-700' : ''}`}>{value}</div>
    </div>
  );
}
