export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'hq' | 'region' | 'branch' | 'director' | 'headquarters' | 'network';
  roleName: string;
  regionId?: string;
  region?: string;
  branchId?: string;
  permissions: string[];
}

export interface DataScope {
  level: 'national' | 'region' | 'branch';
  regionIds?: string[];
  branchIds?: string[];
}

export interface Locker {
  id: string;
  code: string;
  name: string;
  model: string;
  capacity: number;
  region: string;
  regionId: string;
  city: string;
  address: string;
  operator: string;
  installDate: string;
  status: 'online' | 'offline' | 'fault';
  lat: number;
  lng: number;
}

export interface LockerDetail extends Locker {
  todayUsage: number;
  todayTurnover: number;
  avgPickupTime: number;
  avgFaultRecovery: number;
  currentUsage: number;
}

export interface UsageRecord {
  id: string;
  lockerId: string;
  date: string;
  hour: number;
  usageRate: number;
  pickupCount: number;
  deliveryCount: number;
}

export interface PickupDistribution {
  hour: number;
  weekday: number;
  weekend: number;
}

export interface Alert {
  id: string;
  lockerId: string;
  lockerName: string;
  region: string;
  level: 1 | 2;
  type: 'low_usage' | 'fault_timeout';
  message: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'resolved' | 'escalated';
  handledAt?: string;
  handledBy?: string;
}

export interface AlertStats {
  level1: number;
  level2: number;
  handled: number;
  pending: number;
}

export interface ApprovalStep {
  step: 1 | 2 | 3;
  role: string;
  roleName: string;
  approver?: string;
  opinion?: string;
  approved?: boolean;
  approvedAt?: string;
}

export interface Approval {
  id: string;
  alertId: string;
  lockerName: string;
  type: 'restock_adjust' | 'replace_locker';
  typeName: string;
  currentStep: 1 | 2 | 3;
  status: 'pending' | 'approved' | 'rejected';
  steps: ApprovalStep[];
  createdAt: string;
  description: string;
}

export interface RegionStats {
  region: string;
  regionId: string;
  count: number;
  avgUsage: number;
  faultRate: number;
}

export interface ForecastPoint {
  time: string;
  predicted: number;
  lower: number;
  upper: number;
}

export interface Recommendation {
  id: string;
  type: 'add_locker' | 'transfer';
  typeName: string;
  region: string;
  description: string;
  cost: number;
  estimatedBenefit: number;
  priority: 'high' | 'medium' | 'low';
}

export interface WeeklyReport {
  id: string;
  week: string;
  startDate: string;
  endDate: string;
  avgUsage: number;
  avgUsageWoW: number;
  avgUsageYoY: number;
  faultTypes: { type: string; count: number }[];
  restockEfficiency: { region: string; avgTime: number }[];
  recommendations: string[];
  totalLockers: number;
  totalPickups: number;
  avgTurnover: number;
}

export interface DashboardStats {
  totalLockers: number;
  onlineRate: number;
  avgUsage: number;
  avgTurnover: number;
  totalLockersChange: number;
  onlineRateChange: number;
  avgUsageChange: number;
  avgTurnoverChange: number;
}

export interface CommunityEvent {
  id: string;
  name: string;
  community: string;
  region: string;
  startTime: string;
  endTime: string;
  estimatedFootTraffic: number;
}
