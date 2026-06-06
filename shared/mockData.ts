import type {
  User,
  Locker,
  LockerDetail,
  UsageRecord,
  PickupDistribution,
  Alert,
  AlertStats,
  Approval,
  RegionStats,
  ForecastPoint,
  Recommendation,
  WeeklyReport,
  DashboardStats,
  CommunityEvent,
} from './types';

export const mockUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    name: '系统管理员',
    email: 'admin@locker.com',
    role: 'hq',
    roleName: '总部管理员',
    region: '全国',
    permissions: ['all'],
  },
  {
    id: '2',
    username: 'region_manager',
    name: '张伟',
    email: 'zhangwei@locker.com',
    role: 'region',
    roleName: '华东区运营经理',
    regionId: 'region-1',
    region: '华东区',
    permissions: ['region.view', 'region.approval'],
  },
  {
    id: '3',
    username: 'branch_ops',
    name: '李明',
    email: 'liming@locker.com',
    role: 'branch',
    roleName: '上海浦东网点运维',
    regionId: 'region-1',
    region: '华东区',
    branchId: 'branch-1',
    permissions: ['branch.view', 'branch.alert_handle'],
  },
  {
    id: '4',
    username: 'director',
    name: '王总监',
    email: 'wang@locker.com',
    role: 'director',
    roleName: '总部设备总监',
    region: '全国',
    permissions: ['all', 'director.approval'],
  },
  {
    id: '5',
    username: 'liuqiang',
    name: '刘强',
    email: 'liuqiang@locker.com',
    role: 'region',
    roleName: '华北区运营经理',
    regionId: 'region-2',
    region: '华北区',
    permissions: ['region.view', 'region.approval'],
  },
  {
    id: '6',
    username: 'chenfang',
    name: '陈芳',
    email: 'chenfang@locker.com',
    role: 'branch',
    roleName: '北京朝阳网点运维',
    regionId: 'region-2',
    region: '华北区',
    branchId: 'branch-2',
    permissions: ['branch.view', 'branch.alert_handle'],
  },
  {
    id: '7',
    username: 'zhaoming',
    name: '赵明',
    email: 'zhaoming@locker.com',
    role: 'branch',
    roleName: '深圳南山网点运维',
    regionId: 'region-3',
    region: '华南区',
    branchId: 'branch-3',
    permissions: ['branch.view', 'branch.alert_handle'],
  },
  {
    id: '8',
    username: 'huangli',
    name: '黄丽',
    email: 'huangli@locker.com',
    role: 'region',
    roleName: '华南区运营经理',
    regionId: 'region-3',
    region: '华南区',
    permissions: ['region.view', 'region.approval'],
  },
];

const regions = [
  { id: 'region-1', name: '华东区', cities: ['上海', '南京', '杭州', '苏州', '宁波'] },
  { id: 'region-2', name: '华北区', cities: ['北京', '天津', '石家庄', '济南', '青岛'] },
  { id: 'region-3', name: '华南区', cities: ['广州', '深圳', '佛山', '东莞', '厦门'] },
  { id: 'region-4', name: '华中区', cities: ['武汉', '长沙', '郑州', '南昌', '合肥'] },
  { id: 'region-5', name: '西南区', cities: ['成都', '重庆', '昆明', '贵阳', '西安'] },
];

const lockerModels = ['Smart-L200', 'Smart-L300', 'Smart-L500', 'Smart-L800'];
const operators = ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '菜鸟驿站'];
const communityNames = [
  '万科城市花园', '碧桂园凤凰城', '恒大名都', '保利花园', '融创滨江壹号',
  '龙湖天街', '华润橡树湾', '绿地国际花都', '中海国际社区', '金地自在城',
];

function generateLockers(): Locker[] {
  const lockers: Locker[] = [];
  let id = 1;

  regions.forEach((region) => {
    region.cities.forEach((city) => {
      const lockerCount = 8 + Math.floor(Math.random() * 12);
      for (let i = 0; i < lockerCount; i++) {
        const community = communityNames[Math.floor(Math.random() * communityNames.length)];
        const statusRand = Math.random();
        let status: 'online' | 'offline' | 'fault' = 'online';
        if (statusRand > 0.92) status = 'fault';
        else if (statusRand > 0.88) status = 'offline';

        const latBase = region.id === 'region-1' ? 31.2 : region.id === 'region-2' ? 39.9 : region.id === 'region-3' ? 23.1 : region.id === 'region-4' ? 30.5 : 30.7;
        const lngBase = region.id === 'region-1' ? 121.5 : region.id === 'region-2' ? 116.4 : region.id === 'region-3' ? 113.3 : region.id === 'region-4' ? 114.3 : 104.1;

        lockers.push({
          id: `locker-${id}`,
          code: `LK${String(id).padStart(5, '0')}`,
          name: `${city}${community}柜${i + 1}`,
          model: lockerModels[Math.floor(Math.random() * lockerModels.length)],
          capacity: 40 + Math.floor(Math.random() * 60),
          region: region.name,
          regionId: region.id,
          city,
          address: `${city}XX区${community}${i + 1}号门旁`,
          operator: operators[Math.floor(Math.random() * operators.length)],
          installDate: `202${3 + Math.floor(Math.random() * 3)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
          status,
          lat: latBase + (Math.random() - 0.5) * 3,
          lng: lngBase + (Math.random() - 0.5) * 4,
        });
        id++;
      }
    });
  });

  return lockers;
}

export const mockLockers = generateLockers();

export function getLockerDetail(lockerId: string): LockerDetail | undefined {
  const locker = mockLockers.find((l) => l.id === lockerId);
  if (!locker) return undefined;

  return {
    ...locker,
    todayUsage: 35 + Math.random() * 45,
    todayTurnover: 2.1 + Math.random() * 1.5,
    avgPickupTime: 45 + Math.random() * 60,
    avgFaultRecovery: 120 + Math.random() * 180,
    currentUsage: 20 + Math.random() * 60,
  };
}

export function getUsageRecords(lockerId: string, days: number = 7): UsageRecord[] {
  const records: UsageRecord[] = [];
  const now = new Date();

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];

    for (let h = 0; h < 24; h++) {
      let baseRate = 15;
      if (h >= 8 && h <= 10) baseRate = 45;
      else if (h >= 12 && h <= 14) baseRate = 35;
      else if (h >= 18 && h <= 21) baseRate = 65;
      else if (h >= 22 || h < 6) baseRate = 5;

      records.push({
        id: `${lockerId}-${dateStr}-${h}`,
        lockerId,
        date: dateStr,
        hour: h,
        usageRate: Math.max(0, Math.min(100, baseRate + (Math.random() - 0.5) * 20)),
        pickupCount: Math.floor(baseRate * 0.5 + Math.random() * 10),
        deliveryCount: Math.floor(baseRate * 0.2 + Math.random() * 5),
      });
    }
  }

  return records;
}

export function getPickupDistribution(lockerId: string): PickupDistribution[] {
  const distribution: PickupDistribution[] = [];

  for (let h = 0; h < 24; h++) {
    let weekdayBase = 5;
    let weekendBase = 3;

    if (h >= 8 && h <= 10) { weekdayBase = 40; weekendBase = 25; }
    else if (h >= 12 && h <= 14) { weekdayBase = 30; weekendBase = 35; }
    else if (h >= 18 && h <= 21) { weekdayBase = 55; weekendBase = 60; }

    distribution.push({
      hour: h,
      weekday: Math.max(0, weekdayBase + (Math.random() - 0.5) * 10),
      weekend: Math.max(0, weekendBase + (Math.random() - 0.5) * 15),
    });
  }

  return distribution;
}

function generateAlerts(): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();

  for (let i = 0; i < 25; i++) {
    const locker = mockLockers[Math.floor(Math.random() * mockLockers.length)];
    const isLowUsage = Math.random() > 0.4;
    const level = Math.random() > 0.7 ? 2 : 1;
    const hoursAgo = level === 2 ? 5 + Math.random() * 10 : 0.5 + Math.random() * 3;
    const createdAt = new Date(now.getTime() - hoursAgo * 3600000);

    let status: Alert['status'] = 'pending';
    const statusRand = Math.random();
    if (statusRand > 0.7) status = 'processing';
    else if (statusRand > 0.5) status = 'resolved';
    else if (statusRand > 0.45) status = 'escalated';

    alerts.push({
      id: `alert-${i + 1}`,
      lockerId: locker.id,
      lockerName: locker.name,
      region: locker.region,
      level,
      type: isLowUsage ? 'low_usage' : 'fault_timeout',
      message: isLowUsage
        ? `连续3小时使用率低于10%，当前${(Math.random() * 8).toFixed(1)}%`
        : `故障超过2小时未修复，设备已离线`,
      createdAt: createdAt.toISOString(),
      status,
      handledAt: status !== 'pending' && status !== 'escalated'
        ? new Date(createdAt.getTime() + Math.random() * 3600000).toISOString()
        : undefined,
      handledBy: status !== 'pending' && status !== 'escalated' ? mockUsers[2].name : undefined,
    });
  }

  return alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const mockAlerts = generateAlerts();

export const mockAlertStats: AlertStats = {
  level1: mockAlerts.filter((a) => a.level === 1 && a.status !== 'resolved').length,
  level2: mockAlerts.filter((a) => a.level === 2 && a.status !== 'resolved').length,
  handled: mockAlerts.filter((a) => a.status === 'resolved').length,
  pending: mockAlerts.filter((a) => a.status === 'pending' || a.status === 'processing').length,
};

function generateApprovals(): Approval[] {
  const approvals: Approval[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const locker = mockLockers[Math.floor(Math.random() * mockLockers.length)];
    const isRestock = Math.random() > 0.5;
    const currentStep = (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3;
    const statusRand = Math.random();
    let status: Approval['status'] = 'pending';
    if (statusRand > 0.6) status = 'approved';
    else if (statusRand > 0.4) status = 'rejected';

    const steps = [
      { step: 1 as const, role: 'branch', roleName: '网点运维员', approver: currentStep > 1 || status !== 'pending' ? mockUsers[2].name : undefined, opinion: currentStep > 1 ? '情况属实，建议调整' : undefined, approved: currentStep > 1 ? true : undefined, approvedAt: currentStep > 1 ? new Date(now.getTime() - 86400000).toISOString() : undefined },
      { step: 2 as const, role: 'region', roleName: '区域运营经理', approver: currentStep > 2 || (status !== 'pending' && currentStep >= 2) ? mockUsers[1].name : undefined, opinion: currentStep > 2 ? '方案可行，同意执行' : undefined, approved: currentStep > 2 ? true : undefined, approvedAt: currentStep > 2 ? new Date(now.getTime() - 43200000).toISOString() : undefined },
      { step: 3 as const, role: 'director', roleName: '总部设备总监', approver: status === 'approved' || status === 'rejected' ? mockUsers[3].name : undefined, opinion: status !== 'pending' ? (status === 'approved' ? '批准执行' : '暂不执行，继续观察') : undefined, approved: status !== 'pending' ? status === 'approved' : undefined, approvedAt: status !== 'pending' ? new Date(now.getTime() - 21600000).toISOString() : undefined },
    ];

    approvals.push({
      id: `approval-${i + 1}`,
      alertId: `alert-${Math.floor(Math.random() * 20) + 1}`,
      lockerName: locker.name,
      type: isRestock ? 'restock_adjust' : 'replace_locker',
      typeName: isRestock ? '调整补货频次' : '更换柜体',
      currentStep,
      status,
      steps,
      createdAt: new Date(now.getTime() - (Math.random() * 5 + 1) * 86400000).toISOString(),
      description: isRestock
        ? '该区域近期取件量增长30%，建议将补货频次从每日2次调整为每日4次'
        : '该柜机服役超过4年，近3个月故障率达15%，建议更换新型号柜机',
    });
  }

  return approvals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const mockApprovals = generateApprovals();

export function getRegionStats(): RegionStats[] {
  return regions.map((region) => {
    const regionLockers = mockLockers.filter((l) => l.regionId === region.id);
    return {
      region: region.name,
      regionId: region.id,
      count: regionLockers.length,
      avgUsage: 35 + Math.random() * 35,
      faultRate: 2 + Math.random() * 8,
    };
  });
}

export const mockDashboardStats: DashboardStats = {
  totalLockers: mockLockers.length,
  onlineRate: mockLockers.filter((l) => l.status === 'online').length / mockLockers.length * 100,
  avgUsage: 45.6,
  avgTurnover: 3.2,
  totalLockersChange: 5.2,
  onlineRateChange: 1.1,
  avgUsageChange: -2.3,
  avgTurnoverChange: 8.5,
};

export function getForecast72h(regionId?: string): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  const now = new Date();

  for (let h = 0; h < 72; h++) {
    const time = new Date(now.getTime() + h * 3600000);
    const hourOfDay = time.getHours();
    const dayOfWeek = time.getDay();

    let basePickups = 30;
    if (hourOfDay >= 8 && hourOfDay <= 10) basePickups = 80;
    else if (hourOfDay >= 12 && hourOfDay <= 14) basePickups = 65;
    else if (hourOfDay >= 18 && hourOfDay <= 21) basePickups = 120;
    else if (hourOfDay >= 22 || hourOfDay < 6) basePickups = 10;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      basePickups *= 1.2;
    }

    const variance = basePickups * 0.15;
    points.push({
      time: time.toISOString(),
      predicted: basePickups + (Math.random() - 0.5) * variance,
      lower: basePickups - variance,
      upper: basePickups + variance,
    });
  }

  return points;
}

export const mockRecommendations: Recommendation[] = [
  {
    id: 'rec-1',
    type: 'add_locker',
    typeName: '新增柜机',
    region: '华东区',
    description: '上海浦东新区张江板块近30天取件量增长45%，现有柜机高峰时段满柜率达95%，建议新增2组Smart-L500柜机',
    cost: 85000,
    estimatedBenefit: 120000,
    priority: 'high',
  },
  {
    id: 'rec-2',
    type: 'transfer',
    typeName: '柜机调拨',
    region: '华北区',
    description: '北京朝阳区某小区柜机使用率持续低于15%，建议将其中1组柜机调拨至通州区新建小区',
    cost: 8000,
    estimatedBenefit: 45000,
    priority: 'medium',
  },
  {
    id: 'rec-3',
    type: 'add_locker',
    typeName: '新增柜机',
    region: '华南区',
    description: '深圳南山区科技园片区工作日高峰时段平均等待时间超过20分钟，建议新增3组大容量柜机',
    cost: 128000,
    estimatedBenefit: 180000,
    priority: 'high',
  },
  {
    id: 'rec-4',
    type: 'transfer',
    typeName: '柜机调拨',
    region: '西南区',
    description: '成都武侯区部分老旧小区人口外流，柜机资源闲置，建议调拨2组至高新区新建办公楼',
    cost: 6000,
    estimatedBenefit: 38000,
    priority: 'medium',
  },
];

export function generateRecommendations(events: CommunityEvent[]): Recommendation[] {
  const baseRecs = [...mockRecommendations];
  
  events.forEach((event, index) => {
    const trafficMultiplier = Math.min(event.estimatedFootTraffic / 1000, 3);
    const isAddLocker = Math.random() > 0.5;
    
    baseRecs.unshift({
      id: `rec-event-${Date.now()}-${index}`,
      type: isAddLocker ? 'add_locker' : 'transfer',
      typeName: isAddLocker ? '新增柜机' : '柜机调拨',
      region: event.region,
      description: `${event.community}${event.name}活动预计人流${event.estimatedFootTraffic}人次，建议${isAddLocker ? '新增临时柜机' : '从周边调拨柜机'}以应对取件高峰`,
      cost: isAddLocker ? Math.round(35000 * trafficMultiplier) : Math.round(5000 * trafficMultiplier),
      estimatedBenefit: Math.round(25000 * trafficMultiplier),
      priority: event.estimatedFootTraffic > 2000 ? 'high' : event.estimatedFootTraffic > 1000 ? 'medium' : 'low',
    });
  });

  return baseRecs.slice(0, 8);
}

function generateWeeklyReports(): WeeklyReport[] {
  const reports: WeeklyReport[] = [];
  const now = new Date();

  for (let w = 0; w < 8; w++) {
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - w * 7);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);

    reports.push({
      id: `report-${w + 1}`,
      week: `第${24 - w}周`,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      avgUsage: 42 + Math.random() * 10,
      avgUsageWoW: (Math.random() - 0.5) * 8,
      avgUsageYoY: 5 + Math.random() * 10,
      totalLockers: mockLockers.length - w * 5,
      totalPickups: 1200000 - w * 30000,
      avgTurnover: 2.8 + Math.random() * 0.8,
      faultTypes: [
        { type: '电控锁故障', count: 45 + Math.floor(Math.random() * 20) },
        { type: '屏幕无显示', count: 32 + Math.floor(Math.random() * 15) },
        { type: '扫码器异常', count: 28 + Math.floor(Math.random() * 12) },
        { type: '网络连接失败', count: 18 + Math.floor(Math.random() * 10) },
        { type: '其他', count: 12 + Math.floor(Math.random() * 8) },
      ],
      restockEfficiency: regions.map((r) => ({
        region: r.name,
        avgTime: 45 + Math.random() * 30,
      })),
      recommendations: [
        '华东区上海区域建议增加补货频次至每日4次',
        '华南区深圳区域老旧柜机建议分批更换',
        '华中区武汉区域建议新增15组柜机以应对增长需求',
      ],
    });
  }

  return reports;
}

export const mockWeeklyReports = generateWeeklyReports();

export const mockCommunityEvents: CommunityEvent[] = [
  {
    id: 'event-1',
    name: '618购物节快递高峰',
    community: '全城',
    region: '华东区',
    startTime: '2026-06-15T00:00:00.000Z',
    endTime: '2026-06-20T23:59:59.000Z',
    estimatedFootTraffic: 250000,
  },
  {
    id: 'event-2',
    name: '万科城市花园业主开放日',
    community: '万科城市花园',
    region: '华东区',
    startTime: '2026-06-10T09:00:00.000Z',
    endTime: '2026-06-10T18:00:00.000Z',
    estimatedFootTraffic: 5000,
  },
];
