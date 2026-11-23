import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="recovery" role="alert">
      <h1>The interface could not be displayed</h1>
      <p>Reload the interface to reconnect. This action does not reset the database.</p>
      <Button onClick={() => window.location.reload()}>Reload application</Button>
    </main>;
    return this.props.children;
  }
}
