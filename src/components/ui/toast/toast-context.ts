import { createContext } from 'react';
import type { ToastItem } from './ToastProvider';

export const ToastContext = createContext<{
  items: ToastItem[];
  show: (options: ToastOptions) => string;
  replace: (id: string, options: ToastOptions) => void;
  dismiss: (id: string) => void;
} | null>(null);

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type ToastOptions = {
  variant: ToastVariant;
  title: string;
  description: string;
  duration?: number | null;
  dedupeKey?: string;
};
