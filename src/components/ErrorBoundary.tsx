import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StatePanel } from './StatePanel';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last line of defence: catches rendering errors so a visitor sees an apology
 * rather than a blank page or a raw JavaScript exception.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Developers get the detail; visitors never do.
    console.error('Unhandled error while rendering:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="container container--reading">
        <StatePanel
          title="Something went wrong"
          tone="error"
          live="assertive"
          actions={
            <button type="button" className="button button--secondary" onClick={this.handleReload}>
              Reload the page
            </button>
          }
        >
          <p>
            Sorry — this part of the site could not be displayed. Reloading the page usually helps.
          </p>
        </StatePanel>
      </div>
    );
  }
}
