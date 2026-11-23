import { MotionConfig } from 'motion/react';
import { AnimateUIProvider } from '@animate-ui/react/provider';
import { AppLayout } from './app/layouts/AppLayout';
import { FoundationPage } from './features/settings/FoundationPage';

export function App() {
  return <MotionConfig reducedMotion="user"><AnimateUIProvider tempo={0.8}><AppLayout><FoundationPage /></AppLayout></AnimateUIProvider></MotionConfig>;
}
