'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ROW = 44;

function snap(scrollTop: number): number {
  return Math.round(scrollTop / ROW);
}

interface WheelProps {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}

function Wheel({ values, value, onChange, label, format }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (ref.current) {
      const idx = values.indexOf(value);
      ref.current.scrollTop = (idx >= 0 ? idx : 0) * ROW;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScroll() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!ref.current) return;
      const idx = snap(ref.current.scrollTop);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      ref.current.scrollTo({ top: clamped * ROW, behavior: 'smooth' });
      const v = values[clamped];
      if (v !== value) onChange(v);
    }, 120);
  }

  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="text-3xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
        {label}
      </div>
      <div className="relative w-20 h-[220px]">
        {/* Selection highlight band */}
        <div
          className="absolute left-0 right-0 pointer-events-none bg-primary/8 border-y border-primary/20 rounded-md"
          style={{ top: ROW * 2, height: ROW }}
        />
        {/* Fade masks */}
        <div className="absolute inset-x-0 top-0 h-[88px] bg-gradient-to-b from-surface to-transparent pointer-events-none z-10" />
        <div className="absolute inset-x-0 bottom-0 h-[88px] bg-gradient-to-t from-surface to-transparent pointer-events-none z-10" />
        <div
          ref={ref}
          onScroll={onScroll}
          className="absolute inset-0 overflow-y-auto snap-y snap-mandatory scrollbar-none"
          style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
        >
          <style jsx>{`
            div::-webkit-scrollbar { display: none; }
          `}</style>
          <div style={{ height: ROW * 2 }} />
          {values.map((v) => {
            const active = v === value;
            return (
              <div
                key={v}
                className={`h-[44px] flex items-center justify-center snap-center text-lg tabular-nums transition-all ${
                  active ? 'text-foreground font-semibold scale-110' : 'text-muted-foreground/60'
                }`}
              >
                {format ? format(v) : String(v).padStart(2, '0')}
              </div>
            );
          })}
          <div style={{ height: ROW * 2 }} />
        </div>
      </div>
    </div>
  );
}

export function WheelTimePicker({
  value,
  onChange,
  onClose,
}: {
  value: Date;
  onChange: (next: Date) => void;
  onClose: () => void;
}) {
  const t = useTranslations('timePicker');
  const [hour, setHour] = useState(value.getHours());
  const [minute, setMinute] = useState(Math.round(value.getMinutes() / 5) * 5);

  function apply() {
    const next = new Date(value);
    next.setHours(hour, minute, 0, 0);
    onChange(next);
    onClose();
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface-card animate-scale-in w-full max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              {t('title')}
            </div>
            <div className="text-2xl font-semibold tracking-tight2 tabular-nums">
              {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
            </div>
          </div>
          <Button variant="ghost" size="iconSm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center px-4 py-3">
          <Wheel values={hours} value={hour} onChange={setHour} label={t('hours')} />
          <div className="text-2xl font-semibold text-muted-foreground/60 -mt-4">:</div>
          <Wheel values={minutes} value={minute} onChange={setMinute} label={t('minutes')} />
        </div>
        <div className="border-t p-3 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button className="flex-1" onClick={apply}>
            <Check className="h-4 w-4" />
            {t('apply')}
          </Button>
        </div>
      </div>
    </div>
  );
}
