import Toast from './Toast';
import { useToast } from './useToast';

export default function ToastViewport() {
  const { items, dismiss } = useToast();
  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[1100] flex flex-col-reverse gap-2 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(360px,calc(100vw-3rem))]"
      aria-label="Notifications"
    >
      {items.slice(0, 2).map((item) => <Toast key={item.id} item={item} onDismiss={dismiss} />)}
    </div>
  );
}
