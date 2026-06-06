import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Box, Wifi, WifiOff, AlertCircle, ChevronRight } from 'lucide-react';
import { api } from '@/utils/api';
import type { Locker } from '../../shared/types';

export default function LockerList() {
  const navigate = useNavigate();
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  useEffect(() => {
    loadLockers();
  }, [statusFilter, regionFilter]);

  const loadLockers = async () => {
    setLoading(true);
    try {
      let url = '/lockers?pageSize=100';
      if (statusFilter) url += `&status=${statusFilter}`;
      if (regionFilter) url += `&region=${regionFilter}`;
      const data = await api.get<{ list: Locker[]; total: number }>(url);
      setLockers(data.list);
    } catch (error) {
      console.error('Failed to load lockers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLockers = lockers.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: Locker['status']) => {
    switch (status) {
      case 'online':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'offline':
        return <WifiOff className="w-4 h-4 text-slate-400" />;
      case 'fault':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: Locker['status']) => {
    switch (status) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      case 'fault':
        return '故障';
    }
  };

  const getStatusClass = (status: Locker['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-700';
      case 'offline':
        return 'bg-slate-100 text-slate-600';
      case 'fault':
        return 'bg-red-100 text-red-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">柜机管理</h1>
          <p className="text-slate-500 mt-1">管理和查看所有柜机设备</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索柜机编号、名称、地址..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="online">在线</option>
            <option value="offline">离线</option>
            <option value="fault">故障</option>
          </select>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部区域</option>
            <option value="华东区">华东区</option>
            <option value="华北区">华北区</option>
            <option value="华南区">华南区</option>
            <option value="华中区">华中区</option>
            <option value="西南区">西南区</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  柜机编号
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  柜机名称
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  型号
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  所属区域
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  城市
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  容量
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  运营商
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  状态
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : filteredLockers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Box className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    暂无柜机数据
                  </td>
                </tr>
              ) : (
                filteredLockers.map((locker) => (
                  <tr
                    key={locker.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/locker/${locker.id}`)}
                  >
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm text-slate-900">{locker.code}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-900">{locker.name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{locker.address}</div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600">{locker.model}</td>
                    <td className="py-4 px-6 text-sm text-slate-600">{locker.region}</td>
                    <td className="py-4 px-6 text-sm text-slate-600">{locker.city}</td>
                    <td className="py-4 px-6 text-sm text-slate-600">{locker.capacity}格</td>
                    <td className="py-4 px-6 text-sm text-slate-600">{locker.operator}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClass(
                          locker.status
                        )}`}
                      >
                        {getStatusIcon(locker.status)}
                        {getStatusText(locker.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button className="text-blue-600 hover:text-blue-700 p-1">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
