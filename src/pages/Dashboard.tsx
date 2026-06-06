import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TrendingUp,
  Activity,
  RefreshCw,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  MapPin,
  Clock,
} from 'lucide-react';
import { api } from '@/utils/api';
import type { RegionStats, Alert as AlertType, DashboardStats } from '../../shared/types';
import { mockLockers } from '../../shared/mockData';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [regionStats, setRegionStats] = useState<RegionStats[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, regionsData, alertsData] = await Promise.all([
        api.get<DashboardStats>('/lockers/stats/dashboard'),
        api.get<RegionStats[]>('/lockers/stats/by-region'),
        api.get<{ list: AlertType[] }>('/alerts?pageSize=5'),
      ]);
      setStats(statsData);
      setRegionStats(regionsData);
      setRecentAlerts(alertsData.list);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    title,
    value,
    suffix,
    change,
    icon: Icon,
    color,
  }: {
    title: string;
    value: number;
    suffix?: string;
    change: number;
    icon: any;
    color: string;
  }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {value.toFixed(typeof value === 'number' && value % 1 !== 0 ? 1 : 0)}
            {suffix && <span className="text-lg text-slate-500 ml-1">{suffix}</span>}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="flex items-center gap-1 mt-4">
        {change >= 0 ? (
          <ChevronUp className="w-4 h-4 text-green-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-red-500" />
        )}
        <span className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </span>
        <span className="text-sm text-slate-400">较上周</span>
      </div>
    </div>
  );

  const HeatmapPoint = ({ locker, index }: { locker: typeof mockLockers[0]; index: number }) => {
    const x = ((locker.lng - 100) / 35) * 100;
    const y = ((50 - locker.lat) / 25) * 100;
    const statusColor =
      locker.status === 'online'
        ? 'bg-green-500'
        : locker.status === 'fault'
        ? 'bg-red-500'
        : 'bg-slate-400';

    return (
      <button
        key={locker.id}
        onClick={() => navigate(`/locker/${locker.id}`)}
        className={`absolute w-2.5 h-2.5 rounded-full ${statusColor} hover:scale-150 transition-transform cursor-pointer ring-2 ring-white shadow-lg`}
        style={{ left: `${x}%`, top: `${y}%` }}
        title={locker.name}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">运营概览</h1>
          <p className="text-slate-500 mt-1">全国柜机实时运营数据</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          刷新数据
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <StatCard
          title="总柜机数"
          value={stats?.totalLockers || 0}
          change={stats?.totalLockersChange || 0}
          icon={Box}
          color="bg-blue-500"
        />
        <StatCard
          title="在线率"
          value={stats?.onlineRate || 0}
          suffix="%"
          change={stats?.onlineRateChange || 0}
          icon={Activity}
          color="bg-green-500"
        />
        <StatCard
          title="平均使用率"
          value={stats?.avgUsage || 0}
          suffix="%"
          change={stats?.avgUsageChange || 0}
          icon={TrendingUp}
          color="bg-violet-500"
        />
        <StatCard
          title="周转率"
          value={stats?.avgTurnover || 0}
          suffix="次/日"
          change={stats?.avgTurnoverChange || 0}
          icon={RefreshCw}
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">柜机分布热力图</h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-slate-600">正常</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-slate-600">故障</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                <span className="text-slate-600">离线</span>
              </div>
            </div>
          </div>
          <div className="relative h-96 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl overflow-hidden">
            <svg
              className="absolute inset-0 w-full h-full opacity-30"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d="M 10 30 Q 20 20 35 25 T 60 20 T 90 30 L 90 70 Q 75 80 60 75 T 35 80 T 10 70 Z"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="0.5"
              />
            </svg>
            <div className="absolute inset-0">
              {mockLockers.slice(0, 200).map((locker, index) => (
                <HeatmapPoint key={locker.id} locker={locker} index={index} />
              ))}
            </div>
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg text-xs text-slate-600">
              <MapPin className="w-3 h-3 inline mr-1" />
              共展示 {mockLockers.length} 台柜机分布
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">区域使用率排名</h2>
            <div className="space-y-4">
              {regionStats
                .sort((a, b) => b.avgUsage - a.avgUsage)
                .map((region, index) => (
                  <div key={region.regionId}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                            index === 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : index === 1
                              ? 'bg-slate-100 text-slate-600'
                              : index === 2
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-700">{region.region}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {region.avgUsage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                        style={{ width: `${region.avgUsage}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">故障率排名</h2>
            <div className="space-y-4">
              {regionStats
                .sort((a, b) => b.faultRate - a.faultRate)
                .map((region, index) => (
                  <div key={region.regionId}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                            index === 0
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-700">{region.region}</span>
                      </div>
                      <span className="text-sm font-semibold text-red-600">
                        {region.faultRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all"
                        style={{ width: `${region.faultRate * 5}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">实时预警</h2>
          <button
            onClick={() => navigate('/alerts')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            查看全部 →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                  预警级别
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                  柜机名称
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                  所属区域
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                  预警内容
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                  触发时间
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                  状态
                </th>
              </tr>
            </thead>
            <tbody>
              {recentAlerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/alerts')}
                >
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        alert.level === 2
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {alert.level === 2 ? '二级' : '一级'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm font-medium text-slate-900">
                    {alert.lockerName}
                  </td>
                  <td className="py-4 px-4 text-sm text-slate-600">{alert.region}</td>
                  <td className="py-4 px-4 text-sm text-slate-600">{alert.message}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <Clock className="w-4 h-4" />
                      {new Date(alert.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        alert.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : alert.status === 'processing'
                          ? 'bg-blue-100 text-blue-700'
                          : alert.status === 'resolved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {alert.status === 'pending'
                        ? '待处理'
                        : alert.status === 'processing'
                        ? '处理中'
                        : alert.status === 'resolved'
                        ? '已解决'
                        : '已升级'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
