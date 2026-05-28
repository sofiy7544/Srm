'use client';

import {
  Facebook,
  Instagram,
  Send,
  Globe,
  PenLine,
  Users,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const SOURCE_ICONS: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  FB_LEAD_ADS: { Icon: Facebook, color: 'text-[#1877F2]', bg: 'bg-[#1877F2]/10' },
  INSTAGRAM: { Icon: Instagram, color: 'text-[#E4405F]', bg: 'bg-[#E4405F]/10' },
  TELEGRAM: { Icon: Send, color: 'text-[#26A5E4]', bg: 'bg-[#26A5E4]/10' },
  WHATSAPP: { Icon: MessageSquare, color: 'text-[#25D366]', bg: 'bg-[#25D366]/10' },
  WEBSITE: { Icon: Globe, color: 'text-blue-600', bg: 'bg-blue-100' },
  MANUAL: { Icon: PenLine, color: 'text-muted-foreground', bg: 'bg-muted' },
  CSV_IMPORT: { Icon: PenLine, color: 'text-muted-foreground', bg: 'bg-muted' },
  REFERRAL: { Icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-100' },
};

export function SourceIcon({ type, className }: { type: string; className?: string }) {
  const cfg = SOURCE_ICONS[type] ?? SOURCE_ICONS.MANUAL;
  const { Icon, color, bg } = cfg;
  return (
    <span
      className={cn(
        'inline-flex h-5 w-5 rounded-md items-center justify-center shrink-0',
        bg,
        className,
      )}
    >
      <Icon className={cn('h-3 w-3', color)} />
    </span>
  );
}
