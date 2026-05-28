'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/language-switcher';
import { auth, setTokens } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import styles from './login.module.css';

/**
 * Стадии cinematic flow.
 *  - idle      : страница смонтировалась, видео грузится/запускается, форма скрыта
 *  - revealing : запуск анимации проявления карточки (за ~2.5s до конца видео)
 *  - settled   : карточка полностью видна, фон в кино-режиме, ambient float
 */
type Stage = 'idle' | 'revealing' | 'settled';

/** За сколько секунд до конца видео начинаем разворачивать форму. */
const REVEAL_LEAD_SECONDS = 2.5;
/** Полная длительность materialize-анимации карточки. Должна совпадать с CSS. */
const MATERIALIZE_MS = 1200;
/**
 * Раньше: ждали до 6.5с пока проиграется фоновое видео — форма блокировалась.
 * Теперь: ровно одна задержка для запуска `revealing` (форма-в-композиции),
 * а ввод email/пароль доступен с первого кадра.
 */
const HARD_FALLBACK_MS = 600;

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/today';
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('admin@crm.local');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Render the card materialize animation immediately so the password field
  // is focusable from the first paint. Video keeps playing as ambience.
  const [stage, setStage] = useState<Stage>('revealing');

  const videoRef = useRef<HTMLVideoElement>(null);
  const settleTimerRef = useRef<number | null>(null);
  const hardFallbackRef = useRef<number | null>(null);

  /** Безопасный переход вперёд: идём только вперёд, никаких прыжков назад. */
  const advance = useCallback((target: Stage) => {
    setStage((cur) => {
      const order: Stage[] = ['idle', 'revealing', 'settled'];
      return order.indexOf(target) > order.indexOf(cur) ? target : cur;
    });
  }, []);

  const triggerReveal = useCallback(() => {
    advance('revealing');
    if (settleTimerRef.current == null) {
      settleTimerRef.current = window.setTimeout(() => {
        advance('settled');
      }, MATERIALIZE_MS);
    }
  }, [advance]);

  // Reduced motion: сразу settled, без видео-orchestration
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setStage('settled');
      return;
    }
    // Hard fallback: даже если video события вообще не сработают
    hardFallbackRef.current = window.setTimeout(() => {
      triggerReveal();
    }, HARD_FALLBACK_MS);
    return () => {
      if (hardFallbackRef.current) window.clearTimeout(hardFallbackRef.current);
      if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    };
  }, [triggerReveal]);

  /**
   * onTimeUpdate — основной триггер reveal. Срабатывает за 2.5 сек до конца ролика.
   * Лучше чем onEnded потому что:
   *  - форма успевает «родиться» поверх живого видео, без эффекта «ролик закончился»
   *  - страховка если onEnded задерживается из-за throttle
   */
  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !video.duration || !Number.isFinite(video.duration)) return;
    if (video.duration - video.currentTime <= REVEAL_LEAD_SECONDS) {
      triggerReveal();
    }
  }

  function handleEnded() {
    // Останавливаемся ровно на последнем кадре — он работает как стоп-кадр
    const video = videoRef.current;
    if (video) video.pause();
    triggerReveal();
    // Если onEnded прилетел раньше, чем разогрелся materialize таймер — форсим settled
    window.setTimeout(() => advance('settled'), MATERIALIZE_MS);
  }

  function handleVideoError() {
    triggerReveal();
    window.setTimeout(() => advance('settled'), MATERIALIZE_MS);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await auth.login(email, password);
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      router.push(next);
    } catch (e) {
      const err = e as { status?: number };
      if (err.status === 429) {
        setError(t('tooManyAttempts'));
      } else {
        setError(t('loginError'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell} data-stage={stage}>
      {/* ─────── фоновое видео + cinematic слои ─────── */}
      <div className={styles.videoStage} aria-hidden="true">
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/login-bg-poster.jpg"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={handleVideoError}
        >
          <source src="/login-bg.webm" type="video/webm" />
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>
        <div className={styles.aurora} />
        <div className={styles.scrim} />
        <div className={styles.vignette} />
        <div className={styles.grain} />
      </div>

      {/* ─────── header: только иконка слева + language switcher справа ─────── */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <Building2 className="h-4 w-4 text-white" />
          </div>
        </div>
        <LanguageSwitcher />
      </header>

      {/* ─────── центр: glass card ─────── */}
      <div className={styles.center}>
        <div className={styles.cardWrap}>
          <form onSubmit={onSubmit} className={styles.card}>
            <div className={styles.cardStack}>
              <h1 className={styles.title} style={{ ['--i' as string]: 0 }}>
                {t('loginTitle')}
              </h1>

              <div className={styles.field} style={{ ['--i' as string]: 1 }}>
                <Label htmlFor="email" className={styles.label}>
                  {t('email')}
                </Label>
                <div className={styles.inputWrap}>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className={styles.field} style={{ ['--i' as string]: 2 }}>
                <Label htmlFor="password" className={styles.label}>
                  {t('password')}
                </Label>
                <div className={styles.inputWrap}>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className={styles.errorBox} role="alert" style={{ ['--i' as string]: 3 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className={styles.submit}
                disabled={loading}
                style={{ ['--i' as string]: 3 }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('loginButton')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
