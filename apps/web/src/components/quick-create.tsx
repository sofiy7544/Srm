'use client';

/**
 * QuickCreate — global slide-over for creating Client / Lead / Property /
 * Showing from anywhere via ⌘N / ⌘L / ⌘O / ⌘S or the Command Palette.
 *
 * Sprint 2.1 replaces the Sprint-1 placeholder with the real form components.
 * Each form's `onSuccess` returns `true` so the underlying router.push is
 * suppressed — instead we close the slide-over and emit a Sonner toast with
 * a "View" action that navigates to the new record.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  SlideOver,
  SlideOverContent,
  SlideOverHeader,
  SlideOverBody,
} from '@/components/ui/slide-over';
import { ClientForm } from '@/components/client-form';
import { LeadForm } from '@/components/lead-form';
import { PropertyForm } from '@/components/property-form';
import { ShowingForm } from '@/components/showing-form';
import { useUIStore, type QuickCreateKind } from '@/stores/ui-store';

const WIDTH_BY_KIND: Record<QuickCreateKind, 'md' | 'lg'> = {
  client: 'lg', // contacts + preferences need horizontal space
  property: 'lg', // ditto for property gallery + features
  lead: 'md',
  showing: 'md',
};

const TITLE_KEY: Record<QuickCreateKind, string> = {
  client: 'newClient',
  lead: 'newLead',
  property: 'newProperty',
  showing: 'newShowing',
};

export function QuickCreate() {
  const kind = useUIStore((s) => s.quickCreate);
  const close = useUIStore((s) => s.closeQuickCreate);
  const router = useRouter();
  const t = useTranslations('quickCreate');

  const open = kind !== null;
  // Stable kind reference for the SlideOver props while it animates out
  // (kind becomes null before the exit animation finishes — using the *last*
  // non-null value would flicker the wrong header on close, so we just
  // fall back to 'client' which is harmless).
  const safeKind: QuickCreateKind = kind ?? 'client';

  function notify(label: string, href: string) {
    toast.success(label, {
      action: {
        label: t('toastView'),
        onClick: () => router.push(href),
      },
    });
  }

  return (
    <SlideOver open={open} onOpenChange={(v) => (v ? null : close())}>
      <SlideOverContent width={WIDTH_BY_KIND[safeKind]} aria-describedby={undefined}>
        <SlideOverHeader title={t(TITLE_KEY[safeKind])} onClose={close} />
        <SlideOverBody>
          {kind === 'client' ? (
            <ClientForm
              onSuccess={(client) => {
                close();
                notify(t('toastClientCreated', { name: client.fullName }), `/clients/${client.id}`);
                router.refresh();
                return true;
              }}
            />
          ) : null}

          {kind === 'lead' ? (
            <LeadForm
              bare
              onCancel={close}
              onSuccess={(lead) => {
                close();
                notify(
                  t('toastLeadCreated', { name: lead.client?.fullName ?? '—' }),
                  `/leads/${lead.id}`,
                );
                router.refresh();
                return true;
              }}
            />
          ) : null}

          {kind === 'property' ? (
            <PropertyForm
              onSuccess={(property) => {
                close();
                notify(
                  t('toastPropertyCreated', { address: property.address }),
                  `/properties/${property.id}`,
                );
                router.refresh();
                return true;
              }}
            />
          ) : null}

          {kind === 'showing' ? (
            <ShowingForm
              bare
              onCancel={close}
              onSuccess={(_showing) => {
                close();
                notify(t('toastShowingCreated'), `/calendar`);
                router.refresh();
                return true;
              }}
            />
          ) : null}
        </SlideOverBody>
      </SlideOverContent>
    </SlideOver>
  );
}
