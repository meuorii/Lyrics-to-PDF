import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../src/components/ui/toast/ToastProvider';
import ToastViewport from '../../src/components/ui/toast/ToastViewport';
import { useToast } from '../../src/components/ui/toast/useToast';

function ToastHarness() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.show({ variant: 'success', title: 'PDF generated', description: 'Ready to download.' })}>Success</button>
      <button onClick={() => toast.show({ variant: 'error', title: 'Could not generate', description: 'Your lyrics are unchanged.' })}>Error</button>
      <button onClick={() => toast.show({ variant: 'warning', title: 'Document changed', description: 'Update the PDF.' })}>Warning</button>
      <button onClick={() => toast.show({ variant: 'info', title: 'Editor reset', description: 'Workspace cleared.' })}>Info</button>
      <button onClick={() => toast.show({ variant: 'loading', title: 'Generating PDF', description: 'Preparing your document.', duration: null })}>Loading</button>
      <button onClick={() => {
        const id = toast.show({ variant: 'loading', title: 'Generating PDF', description: 'Preparing your document.', duration: null });
        toast.replace(id, { variant: 'success', title: 'PDF generated', description: 'Ready to download.' });
      }}>Replace loading</button>
      <button onClick={() => {
        toast.show({ variant: 'success', title: 'Duplicate', description: 'Same event.', dedupeKey: 'same-event' });
        toast.show({ variant: 'success', title: 'Duplicate', description: 'Same event.', dedupeKey: 'same-event' });
      }}>Duplicate</button>
      <button onClick={() => {
        toast.show({ variant: 'error', title: 'Persistent error', description: 'Still needs attention.' });
        toast.show({ variant: 'info', title: 'Queued info', description: 'Waits its turn.' });
        toast.show({ variant: 'warning', title: 'Queued warning', description: 'Also waits.' });
      }}>Queue three</button>
      <ToastViewport />
    </>
  );
}

function renderHarness() {
  return render(<ToastProvider><ToastHarness /></ToastProvider>);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('toast notifications', () => {
  it.each([
    ['Success', 'PDF generated', 'status'],
    ['Error', 'Could not generate', 'alert'],
    ['Warning', 'Document changed', 'status'],
    ['Info', 'Editor reset', 'status'],
    ['Loading', 'Generating PDF', 'status'],
  ])('announces the %s variant with a dismiss action', (trigger, title, role) => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: trigger }));
    expect(screen.getByRole(role, { name: new RegExp(title) })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Dismiss notification: ${title}` })).toBeTruthy();
  });

  it('replaces a loading notification in place when generation resolves', () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'Replace loading' }));
    expect(screen.queryByText('Generating PDF')).toBeNull();
    expect(screen.getByRole('status', { name: /PDF generated/ })).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('prevents duplicate notifications and queues beyond two visible items without dropping errors', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getAllByRole('status', { name: /Duplicate/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification: Duplicate' }));
    await waitFor(() => expect(screen.queryByRole('status', { name: /Duplicate/ })).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Queue three' }));
    expect(screen.getByRole('alert', { name: /Persistent error/ })).toBeTruthy();
    expect(screen.getByRole('status', { name: /Queued info/ })).toBeTruthy();
    expect(screen.queryByText('Queued warning')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification: Persistent error' }));
    await waitFor(() => expect(screen.getByRole('status', { name: /Queued warning/ })).toBeTruthy());
  });

  it('auto-dismisses success after four seconds and pauses while hovered and focused', () => {
    vi.useFakeTimers();
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'Success' }));
    const toast = screen.getByRole('status', { name: /PDF generated/ });
    act(() => { vi.advanceTimersByTime(2_200); });
    fireEvent.mouseEnter(toast);
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.getByRole('status', { name: /PDF generated/ })).toBeTruthy();
    fireEvent.mouseLeave(toast);
    fireEvent.focus(toast);
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.getByRole('status', { name: /PDF generated/ })).toBeTruthy();
    fireEvent.blur(toast, { relatedTarget: document.body });
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(screen.queryByRole('status', { name: /PDF generated/ })).toBeNull();
  });

  it('keeps errors visible until dismissed', () => {
    vi.useFakeTimers();
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'Error' }));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByRole('alert', { name: /Could not generate/ })).toBeTruthy();
  });
});
