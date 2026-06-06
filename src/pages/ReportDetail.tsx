import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  PieChart,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartPieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '@/utils/api';
import type { WeeklyReport } from '../../shared/types';

const COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#64748b'];

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadReport(id);
    }
  }, [id]);

  const loadReport = async (reportId: string) => {
    setLoading(true);
    try {
      const data = await api.get<WeeklyReport>(`/reports/${reportId}`);
      setReport(data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !report) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  const restockData = report.restockEfficiency.map((item) => ({
    name: item.region,
    avgTime: item.avgTime.toFixed(0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/reports')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">运营诊断周报 - {report.week}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <Calendar className="w-4 h-4" />
            {report.startDate} ~ {report.endDate}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">平均使用率</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{report.avgUsage.toFixed(1)}%</p>
          <div className="flex items-center gap-1 mt-2 text-sm">
            {report.avgUsageWoW >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={report.avgUsageWoW >= 0 ? 'text-green-600' : 'text-red-600'}>
              环比 {report.avgUsageWoW >= 0 ? '+' : ''}{report.avgUsageWoW.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">同比增长</p>
          <p className={`text-3xl font-bold mt-2 ${report.avgUsageYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {report.avgUsageYoY >= 0 ? '+' : ''}{report.avgUsageYoY.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-2">较去年同期</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">总柜机数</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{report.totalLockers}</p>
          <p className="text-xs text-slate-500 mt-2">台在运行</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">总取件量</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {(report.totalPickups / 10000).toFixed(1)}万
          </p>
          <p className="text-xs text-slate-500 mt-2">本周累计</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-violet-500" />
            故障类型分布
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartPieChart>
                <Pie
                  data={report.faultTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="type"
                >
                  {report.faultTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RechartPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            各区域补货效率
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={restockData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} unit="分钟" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                <Tooltip />
                <Bar dataKey="avgTime" name="平均补货时长(分钟)" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          优化策略推荐
        </h2>
        <div className="space-y-3">
          {report.recommendations.map((rec, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 bg-gradient-to-r from-green-50 to-transparent rounded-lg border-l-4 border-green-500"
            >
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-green-700">{index + 1}</span>
              </div>
              <p className="text-sm text-slate-700">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          本周重点关注
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="font-medium text-orange-900 mb-1">高故障区域</h3>
            <p className="text-sm text-orange-700">
              西南区故障率达到8.5%，建议增加巡检频次
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-1">增长潜力区域</h3>
            <p className="text-sm text-blue-700">
              华南区深圳片区取件量同比增长23%，建议增配柜机
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
