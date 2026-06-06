import { useEffect, useState } from 'react';
import {
  TrendingUp,
  Upload,
  Download,
  FileSpreadsheet,
  MapPin,
  Clock,
  DollarSign,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { api } from '@/utils/api';
import type { ForecastPoint, Recommendation, CommunityEvent } from '../../shared/types';

export default function Forecast() {
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [forecast, recs, eventList] = await Promise.all([
        api.get<ForecastPoint[]>('/forecast/72h'),
        api.get<Recommendation[]>('/forecast/recommendations'),
        api.get<CommunityEvent[]>('/forecast/events'),
      ]);

      const formattedForecast = forecast.map((p) => ({
        time: new Date(p.time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: 'numeric' }),
        predicted: Math.round(p.predicted),
        lower: Math.round(p.lower),
        upper: Math.round(p.upper),
      }));

      setForecastData(formattedForecast);
      setRecommendations(recs);
      setEvents(eventList);
    } catch (error) {
      console.error('Failed to load forecast data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      alert('文件上传成功，已提取活动信息并更新预测');
    }, 1500);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高优先级';
      case 'medium':
        return '中优先级';
      case 'low':
        return '低优先级';
      default:
        return priority;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">智能预测</h1>
          <p className="text-slate-500 mt-1">取件量预测与智能调拨推荐</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" />
            下载模板
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? '上传中...' : '上传活动Excel'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            未来72小时取件量预测
          </h2>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">全国</option>
            <option value="region-1">华东区</option>
            <option value="region-2">华北区</option>
            <option value="region-3">华南区</option>
          </select>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} height={60} interval={3} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Area
                type="monotone"
                dataKey="upper"
                stroke="transparent"
                fill="#94a3b8"
                fillOpacity={0.1}
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="transparent"
                fill="#fff"
                fillOpacity={1}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                name="预测取件量"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-8 h-0.5 bg-blue-500"></span>
            <span className="text-slate-600">预测值</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-4 bg-slate-200 opacity-30 rounded"></span>
            <span className="text-slate-600">置信区间</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-violet-500" />
            已录入活动
          </h2>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">{event.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.community}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.startTime).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    {event.estimatedFootTraffic.toLocaleString()}人次
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            智能调拨推荐
          </h2>
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(
                        rec.priority
                      )}`}
                    >
                      {getPriorityText(rec.priority)}
                    </span>
                    <span className="text-sm font-medium text-slate-900">{rec.typeName}</span>
                  </div>
                  <span className="text-xs text-slate-500">{rec.region}</span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{rec.description}</p>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-slate-500">
                      <DollarSign className="w-3 h-3" />
                      成本: ¥{rec.cost.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 text-green-600">
                      <TrendingUp className="w-3 h-3" />
                      预计收益: ¥{rec.estimatedBenefit.toLocaleString()}
                    </span>
                  </div>
                  <button className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
                    查看详情
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
