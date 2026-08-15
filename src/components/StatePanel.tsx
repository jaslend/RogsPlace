import type { ReactNode } from 'react';
import styles from './StatePanel.module.css';

interface StatePanelProps {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: 'neutral' | 'error';
  /** Announce the panel to assistive technology as it appears. */
  live?: 'off' | 'polite' | 'assertive';
}

/**
 * The shared presentation for the states every page needs: loading, empty and
 * failed. Keeping them in one place means each page shows the same thing.
 */
export function StatePanel({
  title,
  children,
  actions,
  tone = 'neutral',
  live = 'off',
}: StatePanelProps) {
  const className = tone === 'error' ? `${styles.panel} ${styles.panelError}` : styles.panel;

  return (
    <div className={className} aria-live={live === 'off' ? undefined : live}>
      <p className={styles.title}>{title}</p>
      {children}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <StatePanel title={label} live="polite" />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <StatePanel title={title} live="polite">
      {children}
    </StatePanel>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <StatePanel
      title="This could not be loaded"
      tone="error"
      live="assertive"
      actions={
        onRetry ? (
          <button type="button" className="button button--secondary" onClick={onRetry}>
            Try again
          </button>
        ) : undefined
      }
    >
      <p>{message}</p>
    </StatePanel>
  );
}
