import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Navigate, Outlet } from 'react-router-dom';

export default function AdminRoute() {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}