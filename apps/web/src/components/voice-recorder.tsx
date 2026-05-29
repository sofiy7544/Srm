'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mic, Square, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploads } from '@/lib/api';
import { toast } from 'sonner';

/**
 * VoiceRecorder — встраиваемый блок записи голосовой заметки.
 *
 * Поведение:
 *   1. По кнопке "Mic" запрашиваем permission на микрофон + стартует MediaRecorder
 *   2. Показываем красную пульсирующую точку + таймер записи MM:SS
 *   3. По кнопке "Stop" собираем blob, превращаем в File, грузим на /uploads/audio
 *   4. Вызываем onRecorded({ url, durationMs, mime }) и сбрасываем состояние
 *
 * Особенности UX:
 *   - Если permission denied — toast с инструкцией
 *   - Если запись > 10 минут — автостоп (большие голосовые редко полезны)
 *   - Превью аудио до загрузки: пользователь может удалить и перезаписать
 *   - На Safari/iOS MediaRecorder выдаёт audio/mp4, на Chrome/Firefox — audio/webm.
 *     Делаем feature-detection MIME через MediaRecorder.isTypeSupported.
 */

interface VoiceRecorderProps {
  onRecorded: (data: { url: string; durationMs: number; mime: string }) => void;
  /** Видеть кнопки запись/остановка в компактном режиме (для inline-форм) */
  compact?: boolean;
}

const MAX_DURATION_MS = 10 * 60 * 1000; // 10 минут

type RecordingState =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: number; mime: string }
  | { kind: 'previewing'; blob: Blob; durationMs: number; mime: string; localUrl: string }
  | { kind: 'uploading' };

export function VoiceRecorder({ onRecorded, compact = false }: VoiceRecorderProps) {
  const t = useTranslations('voiceRecorder');
  const [state, setState] = useState<RecordingState>({ kind: 'idle' });
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);
  // startedAt держим в ref — onstop callback читает из замыкания, и React state
  // в момент вызова уже может быть в другой ветке `state.kind`.
  const startedAtRef = useRef<number>(0);

  // Cleanup на unmount: остановим recorder и закроем mic stream.
  useEffect(() => {
    return () => {
      cleanupRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanupRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    if (tickerRef.current) window.clearInterval(tickerRef.current);
    stopTimerRef.current = null;
    tickerRef.current = null;
  }

  /** Подбирает MIME-тип который поддерживается этим браузером. */
  function pickMime(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/mpeg',
    ];
    for (const m of candidates) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return ''; // браузер сам выберет
  }

  async function startRecording() {
    if (state.kind !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const actualMime = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });
        const durationMs = startedAtRef.current > 0 ? Date.now() - startedAtRef.current : 0;
        const localUrl = URL.createObjectURL(blob);
        setState({ kind: 'previewing', blob, durationMs, mime: actualMime, localUrl });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (tickerRef.current) window.clearInterval(tickerRef.current);
        if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
        tickerRef.current = null;
        stopTimerRef.current = null;
      };

      recorder.start();
      const startedAt = Date.now();
      startedAtRef.current = startedAt;
      setState({ kind: 'recording', startedAt, mime: recorder.mimeType || mime });
      setElapsed(0);

      // Таймер обновления UI каждые 200мс
      tickerRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAt);
      }, 200);

      // Автостоп через 10 минут
      stopTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_DURATION_MS);
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        toast.error(t('permissionDenied'));
      } else {
        toast.error(t('startFailed'));
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  function discardRecording() {
    if (state.kind === 'previewing') {
      URL.revokeObjectURL(state.localUrl);
    }
    setState({ kind: 'idle' });
    setElapsed(0);
  }

  async function uploadRecording() {
    if (state.kind !== 'previewing') return;
    const { blob, durationMs, mime, localUrl } = state;
    setState({ kind: 'uploading' });
    try {
      const result = await uploads.audio(blob);
      URL.revokeObjectURL(localUrl);
      onRecorded({ url: result.url, durationMs, mime });
      setState({ kind: 'idle' });
      setElapsed(0);
    } catch {
      toast.error(t('uploadFailed'));
      // Возвращаем юзера в preview чтобы он мог retry
      setState({ kind: 'previewing', blob, durationMs, mime, localUrl });
    }
  }

  // ─── Render ───
  if (state.kind === 'idle') {
    return (
      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'default'}
        onClick={startRecording}
        title={t('record')}
      >
        <Mic className="h-4 w-4" />
        {!compact && t('record')}
      </Button>
    );
  }

  if (state.kind === 'recording') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
        <span className="relative inline-flex h-2.5 w-2.5">
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="text-sm font-medium tabular-nums text-red-700 dark:text-red-300">
          {formatDuration(elapsed)}
        </span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={stopRecording}
          className="ml-2"
        >
          <Square className="h-3.5 w-3.5" />
          {t('stop')}
        </Button>
      </div>
    );
  }

  if (state.kind === 'previewing') {
    return (
      <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-surface px-2 py-2">
        <audio src={state.localUrl} controls className="h-9 max-w-[260px]" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDuration(state.durationMs)}
        </span>
        <Button type="button" size="sm" onClick={uploadRecording}>
          {t('save')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={discardRecording}
          title={t('discard')}
        >
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>
    );
  }

  // uploading
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t('uploading')}
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

