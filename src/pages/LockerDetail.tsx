import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Cpu,
  Package,
  User,
  Clock,
  Activity,
  RefreshCw,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { api } from '@/utils/api';
import type { LockerDetail, UsageRecord, PickupDistribution } from '../../shared/types';

export default function LockerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [locker, setLocker] = useState<LockerDetail | null>(null);
  const [usageData, setUsageData] = useState<UsageRecord[]>([]);
  const [pickupDistribution, setPickupDistribution] = useState<PickupDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (lockerId: string) => {
    setLoading(true);
    try {
      const [detailData, usageDataResponse, distributionData] = await Promise.all([
        api.get<LockerDetail>(`/lockers/${lockerId}`),
        api.get<UsageRecord[]>(`/lockers/${lockerId}/usage?days=7`),
        api.get<PickupDistribution[]>(`/lockers/${lockerId}/pickup-distribution`),
      ]);
      setLocker(detailData);
      setUsageData(usageDataResponse);
      setPickupDistribution(distributionData);
    } catch (error) {
      console.error('Failed to load locker detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const dailyUsage = usageData.reduce((acc: any[], record) => {
    const existing = acc.find((a) => a.date === record.date);
    if (existing) {
      existing.usageRate = (existing.usageRate + record.usageRate) / 2;
    } else {
      acc.push({ date: record.date.slice(5), usageRate: record.usageRate });
    }
    return acc;
  }, []);

  const hourlyUsage = usageData.slice(-48).map((record) => ({
    time: `${record.date.slice(5)} ${record.hour}:00`,
    usageRate: record.usageRate,
    pickupCount: record.pickupCount,
  }));

  const StatItem = ({ icon: Icon, label, value, color }: any) => (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!locker) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">柜机不存在</p>
        <button
          onClick={() => navigate('/lockers')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/lockers')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{locker.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {locker.address}
            </span>
            <span className="font-mono">{locker.code}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">基础信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatItem icon={Cpu} label="设备型号" value={locker.model} color="bg-blue-500" />
            <StatItem icon={Package} label="格口容量" value={`${locker.capacity}格`} color="bg-violet-500" />
            <StatItem icon={User} label="运营商" value={locker.operator} color="bg-green-500" />
            <StatItem icon={Calendar} label="安装时间" value={locker.installDate} color="bg-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">今日运营数据</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatItem
              icon={Activity}
              label="当前使用率"
              value={`${locker.currentUsage.toFixed(1)}%`}
              color="bg-blue-500"
            />
            <StatItem
              icon={TrendingUp}
              label="今日周转率"
              value={`${locker.todayTurnover.toFixed(1)}次`}
              color="bg-green-500"
            />
            <StatItem
              icon={Clock}
              label="平均取件时长"
              value={`${locker.avgPickupTime.toFixed(0)}秒`}
              color="bg-violet-500"
            />
            <StatItem
              icon={RefreshCw}
              label="平均故障恢复"
              value={`${(locker.avgFaultRecovery / 60).toFixed(1)}小时`}
              color="bg-orange-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            近7天使用率趋势
          </h2>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyUsage}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, '使用率']}
              />
              <Line
                type="monotone"
                dataKey="usageRate"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: '#2563eb', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-500" />
            用户取件时段分布
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-500"></span>
              <span className="text-slate-600">工作日</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-violet-500"></span>
              <span className="text-slate-600">周末</span>
            </div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pickupDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} unit="时" />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
              <Bar dataKey="weekday" name="工作日取件量" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="weekend" name="周末取件量" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">近48小时使用详情</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourlyUsage}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} height={60} interval={5} />
              <YAxis yAxisId="left" stroke="#2563eb" fontSize={12} unit="%" />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="usageRate"
                name="使用率(%)"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pickupCount"
                name="取件数"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
