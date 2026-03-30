import { Component } from 'react';

/**
 * Catches render errors in any child component tree and shows a fallback
 * instead of crashing the entire app.
 *
 * Usage:
 *   <ErrorBoundary label="WaveformDisplay">
 *     <WaveformDisplay ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(
      `[ErrorBoundary] Component "${this.props.label ?? 'unknown'}" crashed:`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      const label = this.props.label ?? 'Component';
      return (
        <div className="error-boundary-fallback">
          <span className="error-boundary-fallback__icon">⚠</span>
          <span className="error-boundary-fallback__text">
            {label} failed to render. Try restarting the app.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
