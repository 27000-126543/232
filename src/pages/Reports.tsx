import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileBarChart,
  Calendar,
  TrendingUp,
  ChevronRight,
  Download,
  Plus,
  FileText,
} from 'lucide-react';
import { api } from '@/utils/api';
import type { WeeklyReport } from '../../shared/types';

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ list: WeeklyReport[]; total: number }>('/reports?pageSize=20');
      setReports(data.list);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      await api.post('/reports/generate-weekly');
      alert('周报生成任务已提交');
      loadReports();
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">运营报告</h1>
          <p className="text-slate-500 mt-1">查看和管理运营诊断报告</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={generateReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            生成周报
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-slate-500">加载中...</div>
        ) : (
          reports.map((report) => (
            <div
              key={report.id}
              onClick={() => navigate(`/reports/${report.id}`)}
              className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileBarChart className="w-6 h-6 text-blue-600" />
                </div>
                <Download className="w-5 h-5 text-slate-400 hover:text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                运营诊断周报 - {report.week}
              </h3>
              <div className="flex items-center gap-1 text-sm text-slate-500 mb-4">
                <Calendar className="w-4 h-4" />
                {report.startDate} ~ {report.endDate}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-500">平均使用率</p>
                  <p className="text-lg font-bold text-slate-900">{report.avgUsage.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">同比</p>
                  <p className={`text-lg font-bold ${report.avgUsageYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {report.avgUsageYoY >= 0 ? '+' : ''}{report.avgUsageYoY.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">总柜机</p>
                  <p className="text-lg font-bold text-slate-900">{report.totalLockers}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-500">{report.recommendations.length}条优化建议</span>
                <span className="flex items-center gap-1 text-sm text-blue-600 font-medium">
                  查看详情
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
