import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Restaurant01Icon, SidebarLeft01Icon, Settings02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/stores/navigation';

export function AppLayout({ children }: { children: ReactNode }) {
  const { compact, toggleCompact } = useNavigation();
  return <div className={`app-shell ${compact ? 'compact' : ''}`}>
    <a href="#main" className="skip-link">Skip to content</a>
    <aside className="sidebar" aria-label="Application navigation">
      <div className="brand"><HugeiconsIcon icon={Restaurant01Icon} aria-hidden="true" /><span>Restaurant Admin</span></div>
      <nav><div className="nav-current"><HugeiconsIcon icon={Settings02Icon} size={18} aria-hidden="true" /><span>Application setup</span></div></nav>
      <p className="sidebar-note">Development build<br />Operational modules pending</p>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <Button variant="ghost" onClick={toggleCompact} aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}><HugeiconsIcon icon={SidebarLeft01Icon} size={20} aria-hidden="true" /></Button>
        <span>Desktop foundation</span><span className="topbar-end">Local operation</span>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
