import { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Building,
  MapPin,
} from 'lucide-react';
import { mockUsers } from '../../shared/mockData';

const roleLabels: Record<string, string> = {
  hq: '总部管理员',
  headquarters: '总部管理员',
  region: '区域运营',
  branch: '网点运维',
  network: '网点运维',
  director: '设备总监',
};

const roleColors: Record<string, string> = {
  hq: 'bg-violet-100 text-violet-700',
  headquarters: 'bg-violet-100 text-violet-700',
  region: 'bg-blue-100 text-blue-700',
  branch: 'bg-green-100 text-green-700',
  network: 'bg-green-100 text-green-700',
  director: 'bg-orange-100 text-orange-700',
};

export default function UserManagement() {
  const [users] = useState(mockUsers);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchText.toLowerCase()) ||
      u.email.toLowerCase().includes(searchText.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">用户管理</h1>
          <p className="text-slate-500 mt-1">管理系统用户和权限</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          新增用户
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索用户名或邮箱..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部角色</option>
          <option value="hq">总部管理员</option>
          <option value="region">区域运营</option>
          <option value="branch">网点运维</option>
          <option value="director">设备总监</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">用户</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">角色</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">区域</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">状态</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-medium">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${roleColors[user.role] || 'bg-slate-100 text-slate-700'}`}
                  >
                    {roleLabels[user.role] || user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {user.region || '全国'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="text-slate-600">正常</span>
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-blue-600">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-slate-500">总用户数</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{users.length}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-violet-600" />
            </div>
            <p className="text-sm text-slate-500">总部管理员</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {users.filter((u) => u.role === 'hq' || u.role === 'headquarters').length}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Building className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-slate-500">区域运营</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {users.filter((u) => u.role === 'region').length}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-sm text-slate-500">网点运维</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {users.filter((u) => u.role === 'branch' || u.role === 'network').length}
          </p>
        </div>
      </div>
    </div>
  );
}
