import type { ReactNode } from 'react';
import { useAuth } from './use-auth';
import { LoginPage } from './login-page';

interface Props {
  children: ReactNode;
}

export function AuthGuard({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <LoginPage />;
  return <>{children}</>;
}
