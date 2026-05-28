'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Кастомный аудио-плеер для голосовых заметок CRM.
 *
 * Зачем не <audio controls>: дефолтный браузерный плеер
 *   - выглядит уродливо и нарушает design language CRM (premium glass / soft shadows)
 *   - имеет разный вид в Chrome / Safari / Firefox / iOS
 *   - не даёт нам контроль над цветами/типографикой
 *
 * Наш плеер:
 *   - Круглая gradient-кнопка Play/Pause (primary→violet)
 *   - Прогресс-бар (тонкая полоска с заполнением)
 *   - Текущее время / общая длительность (tabular-nums)
 *   - Compact mode для inline preview
 *   - Поддержка click on progress bar для seek
 *   - Auto-pause других плееров на странице (single-playback policy)
 */

interface AudioPlayerProps {
  src: string;
  /** Длительность в мс (если известна заранее — показываем до загрузки metadata). */
  durationMs?: number;
  /** Компактный вариант — меньше padding, меньшая кнопка. */
  compact?: boolean;
  className?: string;
}

// Global event для single-playback policy — когда новый плеер стартует,
// все остальные на странице получают команду pause.
const PLAY_EVENT = 'crm:audio-player-start';

export function AudioPlayer({ src, durationMs, compact = false, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(durationMs ?? 0);
  const [loading, setLoading] = useState(false);
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2));

  // Single-playback: когда другой плеер стартует, мы паузимся.
  useEffect(() => {
    function onOtherPlay(e: Event) {
      const detail = (e as CustomEvent).detail as string;
      if (detail !== instanceIdRef.current && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, []);

  function onLoadedMetadata() {
    const a = audioRef.current;
    if (!a) return;
    // Иногда у webm от MediaRecorder duration = Infinity. Trick: seek в большое
    // время, потом обратно — браузер пересчитает.
    if (!Number.isFinite(a.duration) || a.duration === 0) {
      a.currentTime = 1e9;
      const onSeek = () => {
        if (Number.isFinite(a.duration)) {
          setTotalMs(Math.round(a.duration * 1000));
        }
        a.currentTime = 0;
        a.removeEventListener('seeked', onSeek);
      };
      a.addEventListener('seeked', onSeek);
    } else {
      setTotalMs(Math.round(a.duration * 1000));
    }
  }

  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a) return;
    setCurrentMs(Math.round(a.currentTime * 1000));
  }

  async function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // Сообщить другим плеерам остановиться.
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: instanceIdRef.current }));
      setLoading(true);
      try {
        await a.play();
        setPlaying(true);
      } catch {
        // Browser autoplay policy — пользователь должен явно нажать.
        setPlaying(false);
      } finally {
        setLoading(false);
      }
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  function onPause() {
    setPlaying(false);
  }

  function onEnded() {
    setPlaying(false);
    setCurrentMs(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }

  function onProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    const bar = progressRef.current;
    if (!a || !bar || !Number.isFinite(a.duration)) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * a.duration;
    setCurrentMs(Math.round(a.currentTime * 1000));
  }

  const progress = totalMs > 0 ? Math.min(100, (currentMs / totalMs) * 100) : 0;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 rounded-2xl border bg-surface',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
        className,
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onPause={onPause}
      />

      <button
        type="button"
        onClick={togglePlay}
        disabled={loading}
        className={cn(
          'shrink-0 rounded-full flex items-center justify-center text-white shadow-glow transition-all',
          'bg-gradient-to-br from-primary to-violet-500 hover:scale-105 active:scale-95',
          compact ? 'h-7 w-7' : 'h-9 w-9',
        )}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <Pause className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        ) : (
          <Play className={cn('translate-x-px', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        )}
      </button>

      <div
        ref={progressRef}
        onClick={onProgressClick}
        className={cn(
          'relative cursor-pointer h-1.5 rounded-full bg-muted overflow-hidden',
          compact ? 'w-[120px]' : 'w-[180px] sm:w-[220px]',
        )}
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-violet-500 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <span
        className={cn(
          'tabular-nums text-muted-foreground shrink-0',
          compact ? 'text-2xs' : 'text-xs',
        )}
      >
        {formatTime(currentMs)} / {formatTime(totalMs)}
      </span>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
