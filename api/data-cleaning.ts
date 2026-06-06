import { dataCollector, type RawDataRecord, type RawDataType } from './data-collection.js';
import { db } from './database/index.js';
import type { LockerDetail } from '../shared/types.js';

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

export interface ActiveFault {
  id: string;
  lockerId: string;
  faultType: string;
  faultLevel: string;
  startTime: string;
  errorCode: string;
  resolved: boolean;
  resolvedAt?: string;
}

class DataCleaner {
  constructor() {
    dataCollector.on('data:raw', (records: RawDataRecord[]) => {
      this.processRecords(records);
    });
  }

  processRecords(rawRecords: RawDataRecord[]) {
    const processedIds: string[] = [];
    
    rawRecords.forEach(raw => {
      const cleaned = this.validateAndClean(raw);
      
      if (cleaned.isValid) {
        this.updateLockerState(cleaned);
        this.updateHourlyUsage(cleaned);
      }
      
      processedIds.push(raw.id);
    });

    if (processedIds.length > 0) {
      dataCollector.markAsProcessed(processedIds);
    }
  }

  private validateAndClean(raw: RawDataRecord): CleanedRecord {
    const errors: string[] = [];
    let isValid = true;

    const locker = db.prepare('SELECT id, capacity FROM lockers WHERE id = ?').get(raw.lockerId) as any;
    if (!locker) {
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

    if (isValid) {
      isValid = this.validateByType(raw);
      if (!isValid) {
        errors.push('类型特定字段校验失败');
      }
    }

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

  private updateLockerState(cleaned: CleanedRecord) {
    const locker = db.prepare('SELECT * FROM lockers WHERE id = ?').get(cleaned.lockerId) as any;
    if (!locker) return;

    const now = new Date().toISOString();
    let updates: any = { last_update_time: now };

    switch (cleaned.type) {
      case 'pickup':
        this.processPickup(locker, cleaned, updates);
        break;
      case 'delivery':
        this.processDelivery(locker, cleaned, updates);
        break;
      case 'fault':
        this.processFault(locker, cleaned, updates);
        break;
      case 'restock':
        this.processRestock(locker, cleaned, updates);
        break;
      case 'scan':
        break;
    }

    this.recalculateUsageMetrics(cleaned.lockerId, updates);

    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    const stmt = db.prepare(`UPDATE lockers SET ${fields} WHERE id = @id`);
    stmt.run({ ...updates, id: cleaned.lockerId });
  }

  private processPickup(locker: any, cleaned: CleanedRecord, updates: any) {
    if (cleaned.data.duration) {
      const currentAvg = locker.avg_pickup_time || 45;
      const totalPickups = this.getTodayPickupCount(locker.id);
      updates.avg_pickup_time = (currentAvg * totalPickups + cleaned.data.duration) / (totalPickups + 1);
    }
  }

  private processDelivery(locker: any, cleaned: CleanedRecord, updates: any) {
  }

  private processFault(locker: any, cleaned: CleanedRecord, updates: any) {
    updates.status = 'fault';
    updates.last_fault_time = cleaned.timestamp;

    const insertFault = db.prepare(`
      INSERT INTO fault_records (id, locker_id, fault_type, fault_level, error_code, start_time, resolved)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);
    insertFault.run(
      `fault_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      locker.id,
      cleaned.data.faultType,
      cleaned.data.faultLevel || 'minor',
      cleaned.data.errorCode,
      cleaned.timestamp
    );
  }

  private processRestock(locker: any, cleaned: CleanedRecord, updates: any) {
  }

  private updateHourlyUsage(cleaned: CleanedRecord) {
    const date = cleaned.timestamp.split('T')[0];
    const hour = new Date(cleaned.timestamp).getHours();

    const existing = db.prepare(`
      SELECT id, pickup_count, delivery_count, scan_count FROM hourly_usage
      WHERE locker_id = ? AND date = ? AND hour = ?
    `).get(cleaned.lockerId, date, hour) as any;

    if (existing) {
      let pickupCount = existing.pickup_count;
      let deliveryCount = existing.delivery_count;
      let scanCount = existing.scan_count;

      if (cleaned.type === 'pickup') pickupCount++;
      if (cleaned.type === 'delivery') deliveryCount++;
      if (cleaned.type === 'scan') scanCount++;

      const locker = db.prepare('SELECT capacity FROM lockers WHERE id = ?').get(cleaned.lockerId) as any;
      const totalEvents = pickupCount + deliveryCount;
      const usageRate = Math.min(100, (totalEvents / locker.capacity) * 100);

      db.prepare(`
        UPDATE hourly_usage 
        SET pickup_count = ?, delivery_count = ?, scan_count = ?, usage_rate = ?, updated_at = ?
        WHERE id = ?
      `).run(pickupCount, deliveryCount, scanCount, usageRate, new Date().toISOString(), existing.id);
    } else {
      const locker = db.prepare('SELECT capacity FROM lockers WHERE id = ?').get(cleaned.lockerId) as any;
      let pickupCount = 0;
      let deliveryCount = 0;
      let scanCount = 0;

      if (cleaned.type === 'pickup') pickupCount = 1;
      if (cleaned.type === 'delivery') deliveryCount = 1;
      if (cleaned.type === 'scan') scanCount = 1;

      const totalEvents = pickupCount + deliveryCount;
      const usageRate = Math.min(100, (totalEvents / locker.capacity) * 100);

      db.prepare(`
        INSERT INTO hourly_usage (id, locker_id, date, hour, usage_rate, pickup_count, delivery_count, scan_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `usage_${cleaned.lockerId}_${date}_${hour}`,
        cleaned.lockerId,
        date,
        hour,
        usageRate,
        pickupCount,
        deliveryCount,
        scanCount,
        new Date().toISOString()
      );
    }
  }

  private recalculateUsageMetrics(lockerId: string, updates: any) {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();

    const hours = db.prepare(`
      SELECT usage_rate, pickup_count FROM hourly_usage
      WHERE locker_id = ? AND date = ? AND hour <= ?
      ORDER BY hour ASC
    `).all(lockerId, today, currentHour) as any[];

    if (hours.length > 0) {
      const totalUsage = hours.reduce((sum, h) => sum + h.usage_rate, 0);
      const totalPickups = hours.reduce((sum, h) => sum + h.pickup_count, 0);
      const locker = db.prepare('SELECT capacity FROM lockers WHERE id = ?').get(lockerId) as any;

      updates.today_usage = totalUsage / hours.length;
      updates.today_turnover = totalPickups / locker.capacity;
      updates.current_usage = Math.min(100, updates.today_usage * 1.5);
    }
  }

  private getTodayPickupCount(lockerId: string): number {
    const today = new Date().toISOString().split('T')[0];
    const result = db.prepare(`
      SELECT COALESCE(SUM(pickup_count), 0) as total FROM hourly_usage
      WHERE locker_id = ? AND date = ?
    `).get(lockerId, today) as any;
    return result.total || 0;
  }

  getLockerUsageRate(lockerId: string, hours: number = 3): number {
    const now = new Date();
    let totalUsage = 0;
    let count = 0;

    for (let i = 0; i < hours; i++) {
      const checkTime = new Date(now.getTime() - i * 3600000);
      const date = checkTime.toISOString().split('T')[0];
      const hour = checkTime.getHours();

      const usage = db.prepare(`
        SELECT usage_rate FROM hourly_usage
        WHERE locker_id = ? AND date = ? AND hour = ?
      `).get(lockerId, date, hour) as any;

      if (usage) {
        totalUsage += usage.usage_rate;
        count++;
      }
    }

    if (count > 0) {
      return totalUsage / count;
    }

    const locker = db.prepare('SELECT today_usage FROM lockers WHERE id = ?').get(lockerId) as any;
    return locker ? locker.today_usage : 0;
  }

  getActiveFaults(lockerId?: string): ActiveFault[] {
    let query = `
      SELECT f.*, l.name as locker_name
      FROM fault_records f
      JOIN lockers l ON f.locker_id = l.id
      WHERE f.resolved = 0
    `;
    const params: any[] = [];

    if (lockerId) {
      query += ' AND f.locker_id = ?';
      params.push(lockerId);
    }

    query += ' ORDER BY f.start_time DESC';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      lockerId: row.locker_id,
      faultType: row.fault_type,
      faultLevel: row.fault_level,
      startTime: row.start_time,
      errorCode: row.error_code,
      resolved: row.resolved === 1,
      resolvedAt: row.end_time,
    }));
  }

  getLockerDetail(lockerId: string): LockerDetail | null {
    const locker = db.prepare('SELECT * FROM lockers WHERE id = ?').get(lockerId) as any;
    if (!locker) return null;

    return {
      id: locker.id,
      code: locker.code,
      name: locker.name,
      model: locker.model,
      capacity: locker.capacity,
      region: locker.region,
      regionId: locker.region_id,
      city: locker.city,
      address: locker.address,
      operator: locker.operator,
      installDate: locker.install_date,
      status: locker.status,
      lat: locker.lat,
      lng: locker.lng,
      todayUsage: locker.today_usage,
      todayTurnover: locker.today_turnover,
      avgPickupTime: locker.avg_pickup_time,
      avgFaultRecovery: locker.avg_fault_recovery,
      currentUsage: locker.current_usage,
    };
  }

  getAllLockerDetails(): LockerDetail[] {
    const lockers = db.prepare('SELECT * FROM lockers ORDER BY region, city, name').all() as any[];
    return lockers.map(locker => ({
      id: locker.id,
      code: locker.code,
      name: locker.name,
      model: locker.model,
      capacity: locker.capacity,
      region: locker.region,
      regionId: locker.region_id,
      city: locker.city,
      address: locker.address,
      operator: locker.operator,
      installDate: locker.install_date,
      status: locker.status,
      lat: locker.lat,
      lng: locker.lng,
      todayUsage: locker.today_usage,
      todayTurnover: locker.today_turnover,
      avgPickupTime: locker.avg_pickup_time,
      avgFaultRecovery: locker.avg_fault_recovery,
      currentUsage: locker.current_usage,
    }));
  }

  resolveFault(lockerId: string, faultId: string): boolean {
    const result = db.prepare(`
      UPDATE fault_records 
      SET resolved = 1, end_time = ?, resolved_by = 'system'
      WHERE id = ? AND locker_id = ?
    `).run(new Date().toISOString(), faultId, lockerId);

    if (result.changes > 0) {
      const remainingFaults = db.prepare(`
        SELECT COUNT(*) as count FROM fault_records 
        WHERE locker_id = ? AND resolved = 0
      `).get(lockerId) as any;

      if (remainingFaults.count === 0) {
        db.prepare('UPDATE lockers SET status = ? WHERE id = ?').run('online', lockerId);
      }
      return true;
    }
    return false;
  }

  getHourlyUsage(lockerId: string, date: string): any[] {
    return db.prepare(`
      SELECT date, hour, usage_rate, pickup_count, delivery_count, scan_count
      FROM hourly_usage
      WHERE locker_id = ? AND date = ?
      ORDER BY hour ASC
    `).all(lockerId, date) as any[];
  }

  getStats() {
    const lockerCount = db.prepare('SELECT COUNT(*) as count FROM lockers').get() as any;
    const eventCount = db.prepare('SELECT COUNT(*) as count FROM raw_events').get() as any;
    const unprocessedCount = db.prepare('SELECT COUNT(*) as count FROM raw_events WHERE processed = 0').get() as any;
    const faultCount = db.prepare('SELECT COUNT(*) as count FROM fault_records WHERE resolved = 0').get() as any;

    return {
      totalLockers: lockerCount.count,
      totalEvents: eventCount.count,
      unprocessedEvents: unprocessedCount.count,
      activeFaults: faultCount.count,
    };
  }
}

export const dataCleaner = new DataCleaner();
