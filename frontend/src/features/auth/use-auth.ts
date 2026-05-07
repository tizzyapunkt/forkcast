import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { checkSession, login as apiLogin, logout as apiLogout } from '../../api/auth';

const SESSION_KEY = ['auth', 'session'] as const;

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: isAuthenticated = false, isLoading } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: checkSession,
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: apiLogin,
    onSuccess: () => {
      queryClient.setQueryData(SESSION_KEY, true);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      queryClient.setQueryData(SESSION_KEY, false);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    },
  });

  return {
    isAuthenticated,
    isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutate,
    loginError: loginMutation.error,
    isLoginPending: loginMutation.isPending,
  };
}

export { SESSION_KEY };
