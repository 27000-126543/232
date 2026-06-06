import { EventEmitter } from 'events';
import { db } from './database/index.js';

export type RawDataType = 'pickup' | 'delivery' | 'fault' | 'restock' | 'scan';

export interface RawDataRecord {
  id: string;
  type: RawDataType;
  lockerId: string;
  timestamp: string;
  data: Record<string, any>;
  receivedAt: string;
  isValid?: boolean;
  processed?: number;
}

interface DataCollectionStats {
  totalCollected: number;
  byType: Record<RawDataType, number>;
  lastCollectionTime: string | null;
  unprocessedCount: number;
}

class DataCollector extends EventEmitter {
  private isRunning: boolean = false;
  private readIntervalId: NodeJS.Timeout | null = null;
  private stats: DataCollectionStats = {
    totalCollected: 0,
    byType: { pickup: 0, delivery: 0, fault: 0, restock: 0, scan: 0 },
    lastCollectionTime: null,
    unprocessedCount: 0,
  };

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[DataCollector] 启动实时数据接入服务...');
    console.log('[DataCollector] 等待上游系统通过HTTP接口推送事件数据...');
    
    this.readFromDatabase();
    this.readIntervalId = setInterval(() => this.readFromDatabase(), 2000);
  }

  stop() {
    this.isRunning = false;
    if (this.readIntervalId) {
      clearInterval(this.readIntervalId);
      this.readIntervalId = null;
    }
    console.log('[DataCollector] 停止数据接入服务');
  }

  private readFromDatabase() {
    try {
      const rows = db.prepare(`
        SELECT id, type, locker_id, event_time, data_json, received_at, is_valid, processed
        FROM raw_events
        WHERE processed = 0
        ORDER BY received_at ASC
        LIMIT 50
      `).all() as any[];
      
      if (rows.length > 0) {
        const records: RawDataRecord[] = rows.map(row => ({
          id: row.id,
          type: row.type as RawDataType,
          lockerId: row.locker_id,
          timestamp: row.event_time,
          data: JSON.parse(row.data_json || '{}'),
          receivedAt: row.received_at,
          isValid: row.is_valid === 1,
          processed: row.processed,
        }));

        this.stats.totalCollected += records.length;
        records.forEach(r => {
          this.stats.byType[r.type]++;
        });
        this.stats.lastCollectionTime = new Date().toISOString();
        
        const unprocessed = db.prepare('SELECT COUNT(*) as count FROM raw_events WHERE processed = 0').get() as any;
        this.stats.unprocessedCount = unprocessed.count;

        this.emit('data:raw', records);
      }
    } catch (error) {
      console.error('[DataCollector] 读取数据库失败:', error);
    }
  }

  receiveEvent(event: {
    type: RawDataType;
    lockerId: string;
    timestamp?: string;
    data: Record<string, any>;
  }): string {
    const now = new Date().toISOString();
    const eventId = `raw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const locker = db.prepare('SELECT id FROM lockers WHERE id = ?').get(event.lockerId) as any;
    if (!locker) {
      throw new Error(`柜机 ${event.lockerId} 不存在`);
    }

    const validTypes: RawDataType[] = ['pickup', 'delivery', 'fault', 'restock', 'scan'];
    if (!validTypes.includes(event.type)) {
      throw new Error(`无效的事件类型: ${event.type}`);
    }

    db.prepare(`
      INSERT INTO raw_events (
        id, type, locker_id, event_time, data_json, received_at, is_valid, processed, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, NULL)
    `).run(
      eventId,
      event.type,
      event.lockerId,
      event.timestamp || now,
      JSON.stringify(event.data),
      now
    );

    console.log(`[DataCollector] 接收到上游事件: ${event.type}, 柜机: ${event.lockerId}`);
    return eventId;
  }

  receiveBatchEvents(events: Array<{
    type: RawDataType;
    lockerId: string;
    timestamp?: string;
    data: Record<string, any>;
  }>): { success: number; failed: number; ids: string[] } {
    const results: { success: number; failed: number; ids: string[] } = {
      success: 0,
      failed: 0,
      ids: [],
    };

    const tx = db.transaction(() => {
      events.forEach(event => {
        try {
          const id = this.receiveEvent(event);
          results.ids.push(id);
          results.success++;
        } catch (e) {
          results.failed++;
        }
      });
    });

    tx();
    return results;
  }

  markAsProcessed(eventIds: string[]) {
    if (eventIds.length === 0) return;
    
    const placeholders = eventIds.map(() => '?').join(',');
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE raw_events 
      SET processed = 1, processed_at = ?
      WHERE id IN (${placeholders})
    `).run(now, ...eventIds);
  }

  getStats(): DataCollectionStats {
    const unprocessed = db.prepare('SELECT COUNT(*) as count FROM raw_events WHERE processed = 0').get() as any;
    return {
      ...this.stats,
      unprocessedCount: unprocessed.count,
    };
  }

  getRecentRecords(limit: number = 100): RawDataRecord[] {
    const rows = db.prepare(`
      SELECT id, type, locker_id, event_time, data_json, received_at, is_valid, processed
      FROM raw_events
      ORDER BY received_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type as RawDataType,
      lockerId: row.locker_id,
      timestamp: row.event_time,
      data: JSON.parse(row.data_json || '{}'),
      receivedAt: row.received_at,
      isValid: row.is_valid === 1,
      processed: row.processed,
    }));
  }

  getRecordsByLocker(lockerId: string, limit: number = 50): RawDataRecord[] {
    const rows = db.prepare(`
      SELECT id, type, locker_id, event_time, data_json, received_at, is_valid, processed
      FROM raw_events
      WHERE locker_id = ?
      ORDER BY received_at DESC
      LIMIT ?
    `).all(lockerId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type as RawDataType,
      lockerId: row.locker_id,
      timestamp: row.event_time,
      data: JSON.parse(row.data_json || '{}'),
      receivedAt: row.received_at,
      isValid: row.is_valid === 1,
      processed: row.processed,
    }));
  }

  getRecordsByType(type: RawDataType, limit: number = 50): RawDataRecord[] {
    const rows = db.prepare(`
      SELECT id, type, locker_id, event_time, data_json, received_at, is_valid, processed
      FROM raw_events
      WHERE type = ?
      ORDER BY received_at DESC
      LIMIT ?
    `).all(type, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type as RawDataType,
      lockerId: row.locker_id,
      timestamp: row.event_time,
      data: JSON.parse(row.data_json || '{}'),
      receivedAt: row.received_at,
      isValid: row.is_valid === 1,
      processed: row.processed,
    }));
  }
}

export const dataCollector = new DataCollector();
