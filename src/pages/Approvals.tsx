import { useEffect, useState } from 'react';
import { CheckSquare, Clock, Check, X, User, ChevronRight, FileText } from 'lucide-react';
import { api } from '@/utils/api';
import type { Approval } from '../../shared/types';

export default function Approvals() {
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [historyApprovals, setHistoryApprovals] = useState<Approval[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [approvalOpinion, setApprovalOpinion] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pending, history] = await Promise.all([
        api.get<Approval[]>('/approvals/pending'),
        api.get<Approval[]>('/approvals/history'),
      ]);
      setPendingApprovals(pending);
      setHistoryApprovals(history);
    } catch (error) {
      console.error('Failed to load approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approve: boolean) => {
    if (!selectedApproval) return;

    try {
      const currentStep = selectedApproval.currentStep;
      await api.post(`/approvals/${selectedApproval.id}/approve`, {
        approve,
        opinion: approvalOpinion,
        step: currentStep,
      });
      setSelectedApproval(null);
      setApprovalOpinion('');
      loadData();
    } catch (error) {
      console.error('Failed to process approval:', error);
    }
  };

  const currentList = activeTab === 'pending' ? pendingApprovals : historyApprovals;

  const getStatusClass = (status: Approval['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
    }
  };

  const getStatusText = (status: Approval['status']) => {
    switch (status) {
      case 'pending':
        return '待审批';
      case 'approved':
        return '已通过';
      case 'rejected':
        return '已驳回';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">审批中心</h1>
          <p className="text-slate-500 mt-1">三级审批流程管理</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          待我审批 ({pendingApprovals.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          已审批
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                      申请类型
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                      柜机名称
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                      当前步骤
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">
                      申请时间
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
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        加载中...
                      </td>
                    </tr>
                  ) : currentList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <CheckSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        暂无审批数据
                      </td>
                    </tr>
                  ) : (
                    currentList.map((approval) => (
                      <tr
                        key={approval.id}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          selectedApproval?.id === approval.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedApproval(approval)}
                      >
                        <td className="py-4 px-6">
                          <span className="text-sm font-medium text-slate-900">{approval.typeName}</span>
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-600">{approval.lockerName}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                              {approval.currentStep}
                            </span>
                            <span className="text-sm text-slate-600">/ 3</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(approval.createdAt).toLocaleDateString('zh-CN')}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClass(
                              approval.status
                            )}`}
                          >
                            {getStatusText(approval.status)}
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

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          {selectedApproval ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">审批详情</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {new Date(selectedApproval.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">申请类型</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">{selectedApproval.typeName}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">涉及柜机</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedApproval.lockerName}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">申请说明</label>
                  <p className="text-sm text-slate-600 mt-1">{selectedApproval.description}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase mb-3 block">审批流程</label>
                <div className="space-y-3">
                  {selectedApproval.steps.map((step, index) => (
                    <div key={step.step} className="flex items-start gap-3">
                      <div className="relative">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            step.approved !== undefined
                              ? step.approved
                                ? 'bg-green-500'
                                : 'bg-red-500'
                              : index === selectedApproval.currentStep - 1
                              ? 'bg-blue-500 ring-4 ring-blue-100'
                              : 'bg-slate-200'
                          }`}
                        >
                          {step.approved !== undefined ? (
                            step.approved ? (
                              <Check className="w-4 h-4 text-white" />
                            ) : (
                              <X className="w-4 h-4 text-white" />
                            )
                          ) : (
                            <User className="w-4 h-4 text-white" />
                          )}
                        </div>
                        {index < selectedApproval.steps.length - 1 && (
                          <div
                            className={`absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 ${
                              step.approved ? 'bg-green-200' : 'bg-slate-200'
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <p className="text-sm font-medium text-slate-900">{step.roleName}</p>
                        {step.approver && (
                          <p className="text-xs text-slate-500 mt-0.5">{step.approver}</p>
                        )}
                        {step.opinion && (
                          <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded">
                            "{step.opinion}"
                          </p>
                        )}
                        {step.approvedAt && (
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(step.approvedAt).toLocaleString('zh-CN')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {activeTab === 'pending' && selectedApproval.status === 'pending' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">审批意见</label>
                    <textarea
                      value={approvalOpinion}
                      onChange={(e) => setApprovalOpinion(e.target.value)}
                      placeholder="请输入审批意见..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApproval(true)}
                      className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      通过
                    </button>
                    <button
                      onClick={() => handleApproval(false)}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      驳回
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <FileText className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-500">选择一条审批记录查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
