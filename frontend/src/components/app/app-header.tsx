import type { ReactNode } from 'react';

interface AppHeaderProps {
  children?: ReactNode;
  bottom?: ReactNode;
}

export function AppHeader({ children, bottom }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-primary-300 px-4 py-3 text-white shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">forkcast</h1>
        {children}
      </div>
      {bottom}
    </header>
  );
}
