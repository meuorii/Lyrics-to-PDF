import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastOptions, type ToastVariant } from './toast-context';

export type ToastItem = ToastOptions & { id: string; duration: number | null; revision: number };

const DURATIONS: Record<ToastVariant, number | null> = {
  success: 4_000,
  error: null,
  warning: 6_000,
  info: 4_000,
  loading: null,
};

function createItem(id: string, options: ToastOptions, revision = 0): ToastItem {
  return { ...options, id, revision, duration: options.duration === undefined ? DURATIONS[options.variant] : options.duration };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const itemsRef = useRef(items);
  const nextIdRef = useRef(0);

  const updateItems = useCallback((update: (current: ToastItem[]) => ToastItem[]) => {
    const next = update(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const duplicate = options.dedupeKey
      ? itemsRef.current.find((item) => item.dedupeKey === options.dedupeKey)
      : undefined;
    if (duplicate) return duplicate.id;
    const id = `toast-${++nextIdRef.current}`;
    updateItems((current) => [...current, createItem(id, options)]);
    return id;
  }, [updateItems]);

  const replace = useCallback((id: string, options: ToastOptions) => {
    updateItems((current) => current.map((item) => item.id === id ? createItem(id, options, item.revision + 1) : item));
  }, [updateItems]);

  const dismiss = useCallback((id: string) => {
    updateItems((current) => current.filter((item) => item.id !== id));
  }, [updateItems]);

  return <ToastContext.Provider value={{ items, show, replace, dismiss }}>{children}</ToastContext.Provider>;
}
