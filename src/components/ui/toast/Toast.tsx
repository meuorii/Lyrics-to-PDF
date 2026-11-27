import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import type { ToastItem } from './ToastProvider';
import type { ToastVariant } from './toast-context';

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof Info; color: string; surface: string }> = {
  success: { icon: CircleCheck, color: 'text-success', surface: 'bg-success-surface' },
  error: { icon: CircleAlert, color: 'text-error', surface: 'bg-error-surface' },
  warning: { icon: TriangleAlert, color: 'text-warning', surface: 'bg-warning-surface' },
  info: { icon: Info, color: 'text-brand-blue', surface: 'bg-selected' },
  loading: { icon: LoaderCircle, color: 'text-brand-blue', surface: 'bg-selected' },
};

type ToastProps = { item: ToastItem; onDismiss: (id: string) => void };

export default function Toast({ item, onDismiss }: ToastProps) {
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const [progressState, setProgressState] = useState({ revision: item.revision, value: 1 });
  const pausedRef = useRef(false);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const timerControlsRef = useRef<{ pause: () => void; resume: () => void } | null>(null);
  const style = VARIANT_STYLES[item.variant];
  const Icon = style.icon;

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => onDismiss(item.id), 200);
  }, [item.id, onDismiss]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (item.duration === null) return;
    let remaining = item.duration;
    let startedAt = 0;
    let timer: number | null = null;
    let ticker: number | null = null;

    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      if (ticker !== null) window.clearInterval(ticker);
      timer = null;
      ticker = null;
    };
    const pause = () => {
      if (pausedRef.current) return;
      pausedRef.current = true;
      clear();
      remaining = Math.max(0, remaining - (performance.now() - startedAt));
      setProgressState({ revision: item.revision, value: remaining / item.duration! });
    };
    const resume = () => {
      if (!pausedRef.current && timer !== null) return;
      if (hoveredRef.current || focusedRef.current || closingRef.current) return;
      pausedRef.current = false;
      startedAt = performance.now();
      timer = window.setTimeout(close, remaining);
      ticker = window.setInterval(() => {
        const current = Math.max(0, remaining - (performance.now() - startedAt));
        setProgressState({ revision: item.revision, value: current / item.duration! });
      }, 50);
    };
    timerControlsRef.current = { pause, resume };
    if (hoveredRef.current || focusedRef.current) pause();
    else resume();

    return () => {
      clear();
      timerControlsRef.current = null;
    };
  }, [item.id, item.revision, item.duration, close]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  function pause() {
    timerControlsRef.current?.pause();
  }

  function resume() {
    if (!hoveredRef.current && !focusedRef.current) timerControlsRef.current?.resume();
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    focusedRef.current = false;
    resume();
  }

  return (
    <div
      role={item.variant === 'error' ? 'alert' : 'status'}
      aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-label={`${item.title}. ${item.description}`}
      data-toast-id={item.id}
      className={`pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-line bg-surface p-4 text-left shadow-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${entered && !closing ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
      onMouseEnter={() => { hoveredRef.current = true; pause(); }}
      onMouseLeave={() => { hoveredRef.current = false; resume(); }}
      onFocusCapture={() => { focusedRef.current = true; pause(); }}
      onBlurCapture={handleBlur}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${style.surface} ${style.color}`} aria-hidden="true">
        <Icon size={20} className={item.variant === 'loading' ? 'motion-safe:animate-spin' : undefined} />
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block text-sm font-bold leading-5 text-ink">{item.title}</span>
        <span className="mt-0.5 block text-[13px] leading-[1.4] text-muted">{item.description}</span>
      </span>
      <button
        type="button"
        aria-label={`Dismiss notification: ${item.title}`}
        className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-disabled-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-blue"
        onClick={close}
      >
        <X size={16} aria-hidden="true" />
      </button>
      {item.duration !== null && (
        <span className={`absolute inset-x-0 bottom-0 h-0.5 ${style.color}`} aria-hidden="true">
          <span className="block h-full origin-left bg-current transition-transform duration-75" style={{ transform: `scaleX(${progressState.revision === item.revision ? progressState.value : 1})` }} />
        </span>
      )}
    </div>
  );
}
