import { dataCollector, RawDataRecord, RawDataType } from './data-collection';
import { mockLockers } from '../shared/mockData';
import type { LockerDetail, UsageRecord } from '../shared/types';

export interface CleanedRecord {
  id: string;
  originalId: string;
  type: RawDataType;
  lockerId: string;
  timestamp: string;
  processedAt: string;
  isValid: boolean;
  validationErrors: string[];
  data: Record<string, any>;
}

export interface LockerArchive {
  locker: LockerDetail;
  lastUpdate: string;
  hourlyUsage: Map<string, UsageRecord>;
  activeFaults: ActiveFault[];
  restockHistory: RestockRecord[];
  stats: LockerStats;
}

export interface ActiveFault {
  id: string;
  faultType: string;
  faultLevel: string;
  startTime: string;
  errorCode: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface RestockRecord {
  id: string;
  timestamp: string;
  operatorId: string;
  beforeCount: number;
  afterCount: number;
  duration: number;
}

export interface LockerStats {
  totalPickups24h: number;
  totalDeliveries24h: number;
  avgPickupDuration: number;
  avgRestockDuration: number;
  faultCount24h: number;
  scanCount24h: number;
}

class DataCleaner {
  private cleanedRecords: CleanedRecord[] = [];
  private lockerArchives: Map<string, LockerArchive> = new Map();
  private readonly MAX_CLEANED_RECORDS = 5000;

  constructor() {
    this.initArchives();
    dataCollector.on('data:raw', (records: RawDataRecord[]) => {
      this.processRecords(records);
    });
  }

  private initArchives() {
    mockLockers.forEach(locker => {
      const archive: LockerArchive = {
        locker: {
          ...locker,
          todayUsage: Math.random() * 60 + 20,
          todayTurnover: Math.random() * 4 + 1,
          avgPickupTime: Math.random() * 60 + 30,
          avgFaultRecovery: Math.random() * 120 + 30,
          currentUsage: Math.random() * 80 + 10,
        },
        lastUpdate: new Date().toISOString(),
        hourlyUsage: new Map(),
        activeFaults: [],
        restockHistory: [],
        stats: {
          totalPickups24h: 0,
          totalDeliveries24h: 0,
          avgPickupDuration: 45,
          avgRestockDuration: 180,
          faultCount24h: 0,
          scanCount24h: 0,
        },
      };
      this.lockerArchives.set(locker.id, archive);
    });
  }

  processRecords(rawRecords: RawDataRecord[]) {
    rawRecords.forEach(raw => {
      const cleaned = this.validateAndClean(raw);
      this.cleanedRecords.push(cleaned);
      
      if (this.cleanedRecords.length > this.MAX_CLEANED_RECORDS) {
        this.cleanedRecords.shift();
      }

      if (cleaned.isValid) {
        this.updateLockerArchive(cleaned);
      }
    });
  }

  private validateAndClean(raw: RawDataRecord): CleanedRecord {
    const errors: string[] = [];
    let isValid = true;

    if (!raw.lockerId || !this.lockerArchives.has(raw.lockerId)) {
      errors.push('无效的柜机ID');
      isValid = false;
    }

    if (!raw.timestamp || isNaN(new Date(raw.timestamp).getTime())) {
      errors.push('无效的时间戳');
      isValid = false;
    }

    if (!raw.data || typeof raw.data !== 'object') {
      errors.push('无效的数据内容');
      isValid = false;
    }

    isValid = isValid && this.validateByType(raw);

    return {
      id: `cleaned_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalId: raw.id,
      type: raw.type,
      lockerId: raw.lockerId,
      timestamp: raw.timestamp,
      processedAt: new Date().toISOString(),
      isValid,
      validationErrors: errors,
      data: raw.data,
    };
  }

  private validateByType(raw: RawDataRecord): boolean {
    switch (raw.type) {
      case 'pickup':
        return !!raw.data.trackingNo && raw.data.compartment > 0;
      case 'delivery':
        return !!raw.data.trackingNo && !!raw.data.courierId;
      case 'fault':
        return !!raw.data.faultType && !!raw.data.errorCode;
      case 'restock':
        return raw.data.beforeCount >= 0 && raw.data.afterCount >= raw.data.beforeCount;
      case 'scan':
        return !!raw.data.userId && !!raw.data.action;
      default:
        return false;
    }
  }

  private updateLockerArchive(cleaned: CleanedRecord) {
    const archive = this.lockerArchives.get(cleaned.lockerId);
    if (!archive) return;

    archive.lastUpdate = new Date().toISOString();

    switch (cleaned.type) {
      case 'pickup':
        this.processPickup(archive, cleaned);
        break;
      case 'delivery':
        this.processDelivery(archive, cleaned);
        break;
      case 'fault':
        this.processFault(archive, cleaned);
        break;
      case 'restock':
        this.processRestock(archive, cleaned);
        break;
      case 'scan':
        archive.stats.scanCount24h++;
        break;
    }

    this.updateUsageMetrics(archive);
  }

  private processPickup(archive: LockerArchive, cleaned: CleanedRecord) {
    archive.stats.totalPickups24h++;
    
    if (cleaned.data.duration) {
      const currentAvg = archive.stats.avgPickupDuration;
      const total = archive.stats.totalPickups24h;
      archive.stats.avgPickupDuration = (currentAvg * (total - 1) + cleaned.data.duration) / total;
    }

    const hourKey = this.getHourKey(cleaned.timestamp);
    if (!archive.hourlyUsage.has(hourKey)) {
      archive.hourlyUsage.set(hourKey, {
        id: `usage_${archive.locker.id}_${hourKey}`,
        lockerId: archive.locker.id,
        date: hourKey.split('_')[0],
        hour: parseInt(hourKey.split('_')[1]),
        usageRate: 0,
        pickupCount: 0,
        deliveryCount: 0,
      });
    }
    
    const hourUsage = archive.hourlyUsage.get(hourKey)!;
    hourUsage.pickupCount++;
    hourUsage.usageRate = Math.min(100, (hourUsage.pickupCount + hourUsage.deliveryCount) / archive.locker.capacity * 100);
  }

  private processDelivery(archive: LockerArchive, cleaned: CleanedRecord) {
    archive.stats.totalDeliveries24h++;
    
    const hourKey = this.getHourKey(cleaned.timestamp);
    if (!archive.hourlyUsage.has(hourKey)) {
      archive.hourlyUsage.set(hourKey, {
        id: `usage_${archive.locker.id}_${hourKey}`,
        lockerId: archive.locker.id,
        date: hourKey.split('_')[0],
        hour: parseInt(hourKey.split('_')[1]),
        usageRate: 0,
        pickupCount: 0,
        deliveryCount: 0,
      });
    }
    
    const hourUsage = archive.hourlyUsage.get(hourKey)!;
    hourUsage.deliveryCount++;
    hourUsage.usageRate = Math.min(100, (hourUsage.pickupCount + hourUsage.deliveryCount) / archive.locker.capacity * 100);
  }

  private processFault(archive: LockerArchive, cleaned: CleanedRecord) {
    archive.stats.faultCount24h++;
    archive.locker.status = 'fault';

    const fault: ActiveFault = {
      id: `fault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      faultType: cleaned.data.faultType,
      faultLevel: cleaned.data.faultLevel,
      startTime: cleaned.timestamp,
      errorCode: cleaned.data.errorCode,
      resolved: false,
    };
    archive.activeFaults.push(fault);
  }

  private processRestock(archive: LockerArchive, cleaned: CleanedRecord) {
    const record: RestockRecord = {
      id: `restock_${Date.now()}`,
      timestamp: cleaned.timestamp,
      operatorId: cleaned.data.operatorId,
      beforeCount: cleaned.data.beforeCount,
      afterCount: cleaned.data.afterCount,
      duration: cleaned.data.duration,
    };
    archive.restockHistory.push(record);
    
    if (archive.restockHistory.length > 100) {
      archive.restockHistory.shift();
    }

    const restockTimes = archive.restockHistory.length;
    archive.stats.avgRestockDuration = (archive.stats.avgRestockDuration * (restockTimes - 1) + cleaned.data.duration) / restockTimes;
  }

  private updateUsageMetrics(archive: LockerArchive) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();

    let todayTotal = 0;
    let todayUsageSum = 0;
    let hoursWithData = 0;

    for (let h = 0; h <= currentHour; h++) {
      const key = `${today}_${h}`;
      const usage = archive.hourlyUsage.get(key);
      if (usage) {
        todayTotal += usage.pickupCount;
        todayUsageSum += usage.usageRate;
        hoursWithData++;
      }
    }

    archive.locker.todayUsage = hoursWithData > 0 ? todayUsageSum / hoursWithData : 0;
    archive.locker.todayTurnover = todayTotal > 0 ? (todayTotal / archive.locker.capacity) : 0;
    archive.locker.currentUsage = Math.min(100, archive.locker.todayUsage * 1.5);
    archive.locker.avgPickupTime = archive.stats.avgPickupDuration;
  }

  private getHourKey(timestamp: string): string {
    const date = new Date(timestamp);
    return `${date.toISOString().split('T')[0]}_${date.getHours()}`;
  }

  getLockerArchive(lockerId: string): LockerArchive | undefined {
    return this.lockerArchives.get(lockerId);
  }

  getAllArchives(): LockerArchive[] {
    return Array.from(this.lockerArchives.values());
  }

  getActiveFaults(lockerId?: string): ActiveFault[] {
    const faults: ActiveFault[] = [];
    this.lockerArchives.forEach(archive => {
      if (!lockerId || archive.locker.id === lockerId) {
        archive.activeFaults
          .filter(f => !f.resolved)
          .forEach(f => faults.push(f));
      }
    });
    return faults;
  }

  getLockerUsageRate(lockerId: string, hours: number = 3): number {
    const archive = this.lockerArchives.get(lockerId);
    if (!archive) return 0;

    const now = new Date();
    let totalUsage = 0;
    let count = 0;

    for (let i = 0; i < hours; i++) {
      const checkTime = new Date(now.getTime() - i * 3600000);
      const key = this.getHourKey(checkTime.toISOString());
      const usage = archive.hourlyUsage.get(key);
      if (usage) {
        totalUsage += usage.usageRate;
        count++;
      }
    }

    return count > 0 ? totalUsage / count : archive.locker.todayUsage;
  }

  getCleanedRecords(limit: number = 100): CleanedRecord[] {
    return this.cleanedRecords.slice(-limit);
  }

  getStats() {
    return {
      totalCleaned: this.cleanedRecords.length,
      validRecords: this.cleanedRecords.filter(r => r.isValid).length,
      invalidRecords: this.cleanedRecords.filter(r => !r.isValid).length,
      activeLockers: this.lockerArchives.size,
    };
  }

  resolveFault(lockerId: string, faultId: string): boolean {
    const archive = this.lockerArchives.get(lockerId);
    if (!archive) return false;

    const fault = archive.activeFaults.find(f => f.id === faultId);
    if (fault) {
      fault.resolved = true;
      fault.resolvedAt = new Date().toISOString();
      
      if (archive.activeFaults.every(f => f.resolved)) {
        archive.locker.status = 'online';
      }
      return true;
    }
    return false;
  }
}

export const dataCleaner = new DataCleaner();
