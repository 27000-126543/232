import { Bell, Search, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';

export function Header() {
  const { user } = useAuthStore();
  const [searchValue, setSearchValue] = useState('');

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索柜机编号、地址..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-80 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全国</option>
          <option value="region-1">华东区</option>
          <option value="region-2">华北区</option>
          <option value="region-3">华南区</option>
          <option value="region-4">华中区</option>
          <option value="region-5">西南区</option>
        </select>

        <button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <Settings className="w-5 h-5" />
        </button>

        <div className="h-8 w-px bg-slate-200"></div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.roleName}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
