import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { api } from '@/utils/api';
import type { Alert, AlertStats } from '../../shared/types';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadData();
  }, [levelFilter, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      let url = '/alerts?pageSize=50';
      if (levelFilter) url += `&level=${levelFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const [alertsData, statsData] = await Promise.all([
        api.get<{ list: Alert[]; total: number }>(url),
        api.get<AlertStats>('/alerts/stats'),
      ]);
      setAlerts(alertsData.list);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlert = async (alertId: string, action: string) => {
    try {
      await api.post(`/alerts/${alertId}/handle`, { action, remark: '' });
      loadData();
    } catch (error) {
      console.error('Failed to handle alert:', error);
    }
  };

  const getStatusText = (status: Alert['status']) => {
    switch (status) {
      case 'pending':
        return '待处理';
      case 'processing':
        return '处理中';
      case 'resolved':
        return '已解决';
      case 'escalated':
        return '已升级';
    }
  };

  const getStatusClass = (status: Alert['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'resolved':
        return 'bg-green-100 text-green-700';
      case 'escalated':
        return 'bg-red-100 text-red-700';
    }
  };

  const StatCard = ({ label, value, color, icon: Icon }: any) => (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${color.replace('text-', 'bg-').replace('-700', '-100')} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">预警中心</h1>
          <p className="text-slate-500 mt-1">实时监控和处理柜机预警信息</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="一级预警" value={stats?.level1 || 0} color="text-orange-600" icon={AlertTriangle} />
        <StatCard label="二级预警" value={stats?.level2 || 0} color="text-red-600" icon={XCircle} />
        <StatCard label="待处理" value={stats?.pending || 0} color="text-yellow-600" icon={Clock} />
        <StatCard label="已处理" value={stats?.handled || 0} color="text-green-600" icon={CheckCircle} />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部级别</option>
            <option value="1">一级预警</option>
            <option value="2">二级预警</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="processing">处理中</option>
            <option value="resolved">已解决</option>
            <option value="escalated">已升级</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  级别
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  类型
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  柜机名称
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  区域
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  预警内容
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                  触发时间
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
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <AlertTriangle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    暂无预警数据
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          alert.level === 2 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {alert.level === 2 ? '二级' : '一级'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600">
                      {alert.type === 'low_usage' ? '使用率过低' : '故障超时'}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-slate-900">{alert.lockerName}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <MapPin className="w-3.5 h-3.5" />
                        {alert.region}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600 max-w-xs truncate">
                      {alert.message}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(alert.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClass(
                          alert.status
                        )}`}
                      >
                        {getStatusText(alert.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {alert.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAlert(alert.id, 'process')}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                          >
                            处理
                          </button>
                          <button
                            onClick={() => handleAlert(alert.id, 'resolve')}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                          >
                            解决
                          </button>
                        </div>
                      )}
                      {alert.status === 'processing' && (
                        <button
                          onClick={() => handleAlert(alert.id, 'resolve')}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                        >
                          标记已解决
                        </button>
                      )}
                      {(alert.status === 'resolved' || alert.status === 'escalated') && (
                        <span className="text-xs text-slate-400">-</span>
                      )}
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
