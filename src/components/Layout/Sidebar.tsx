import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Box,
  AlertTriangle,
  CheckSquare,
  TrendingUp,
  FileBarChart,
  Users,
  Shield,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const menuItems = [
  { path: '/dashboard', label: '核心看板', icon: LayoutDashboard },
  { path: '/lockers', label: '柜机管理', icon: Box },
  { path: '/alerts', label: '预警中心', icon: AlertTriangle },
  { path: '/approvals', label: '审批中心', icon: CheckSquare },
  { path: '/forecast', label: '智能预测', icon: TrendingUp },
  { path: '/reports', label: '运营报告', icon: FileBarChart },
];

const adminMenuItems = [
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/roles', label: '角色权限', icon: Shield },
];

export function Sidebar() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  const isAdmin = user?.role === 'hq';

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-blue-400">智能快递柜运营平台</h1>
        <p className="text-xs text-slate-400 mt-1">Smart Locker Analytics</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs text-slate-500 uppercase tracking-wider">系统管理</p>
            </div>
            {adminMenuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.roleName}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">退出登录</span>
        </button>
      </div>
    </aside>
  );
}
