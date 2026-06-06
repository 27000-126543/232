import { EventEmitter } from 'events';
import { mockLockers } from '../shared/mockData';

export type RawDataType = 'pickup' | 'delivery' | 'fault' | 'restock' | 'scan';

export interface RawDataRecord {
  id: string;
  type: RawDataType;
  lockerId: string;
  timestamp: string;
  data: Record<string, any>;
  receivedAt: string;
}

interface DataCollectionStats {
  totalCollected: number;
  byType: Record<RawDataType, number>;
  lastCollectionTime: string | null;
}

class DataCollector extends EventEmitter {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private rawDataBuffer: RawDataRecord[] = [];
  private stats: DataCollectionStats = {
    totalCollected: 0,
    byType: { pickup: 0, delivery: 0, fault: 0, restock: 0, scan: 0 },
    lastCollectionTime: null,
  };
  private readonly MAX_BUFFER_SIZE = 10000;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[DataCollector] 启动实时数据接入服务...');
    
    this.collectData();
    this.intervalId = setInterval(() => this.collectData(), 2000);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[DataCollector] 停止数据接入服务');
  }

  private collectData() {
    const records: RawDataRecord[] = [];
    const numRecords = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < numRecords; i++) {
      const locker = mockLockers[Math.floor(Math.random() * mockLockers.length)];
      const types: RawDataType[] = ['pickup', 'delivery', 'fault', 'restock', 'scan'];
      const weights = [0.4, 0.25, 0.05, 0.1, 0.2];
      
      let random = Math.random();
      let type: RawDataType = 'pickup';
      let cumulative = 0;
      for (let j = 0; j < types.length; j++) {
        cumulative += weights[j];
        if (random < cumulative) {
          type = types[j];
          break;
        }
      }

      const record = this.generateRecord(locker.id, type);
      records.push(record);
      this.rawDataBuffer.push(record);
      
      if (this.rawDataBuffer.length > this.MAX_BUFFER_SIZE) {
        this.rawDataBuffer.shift();
      }

      this.stats.totalCollected++;
      this.stats.byType[type]++;
    }

    this.stats.lastCollectionTime = new Date().toISOString();
    this.emit('data:raw', records);
  }

  private generateRecord(lockerId: string, type: RawDataType): RawDataRecord {
    const now = new Date();
    const baseData: Record<string, any> = {};

    switch (type) {
      case 'pickup':
        baseData.trackingNo = `SF${Math.floor(Math.random() * 10000000000)}`;
        baseData.compartment = Math.floor(Math.random() * 36) + 1;
        baseData.duration = Math.floor(Math.random() * 180) + 10;
        baseData.userId = `user_${Math.floor(Math.random() * 10000)}`;
        break;
      case 'delivery':
        baseData.trackingNo = `YD${Math.floor(Math.random() * 10000000000)}`;
        baseData.compartment = Math.floor(Math.random() * 36) + 1;
        baseData.courierId = `courier_${Math.floor(Math.random() * 500)}`;
        baseData.size = ['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)];
        break;
      case 'fault':
        const faultTypes = ['door_stuck', 'screen_failure', 'network_error', 'payment_failure', 'system_crash'];
        baseData.faultType = faultTypes[Math.floor(Math.random() * faultTypes.length)];
        baseData.faultLevel = Math.random() > 0.3 ? 'minor' : 'major';
        baseData.errorCode = `ERR-${Math.floor(Math.random() * 1000)}`;
        break;
      case 'restock':
        baseData.operatorId = `op_${Math.floor(Math.random() * 100)}`;
        baseData.beforeCount = Math.floor(Math.random() * 20);
        baseData.afterCount = Math.floor(Math.random() * 15) + baseData.beforeCount + 5;
        baseData.duration = Math.floor(Math.random() * 600) + 60;
        break;
      case 'scan':
        baseData.userId = `user_${Math.floor(Math.random() * 10000)}`;
        baseData.action = ['open_door', 'query', 'payment', 'bind'][Math.floor(Math.random() * 4)];
        baseData.deviceType = ['ios', 'android', 'mini_program'][Math.floor(Math.random() * 3)];
        break;
    }

    return {
      id: `raw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      lockerId,
      timestamp: now.toISOString(),
      data: baseData,
      receivedAt: now.toISOString(),
    };
  }

  getStats(): DataCollectionStats {
    return { ...this.stats };
  }

  getRecentRecords(limit: number = 100): RawDataRecord[] {
    return this.rawDataBuffer.slice(-limit);
  }

  getRecordsByLocker(lockerId: string, limit: number = 50): RawDataRecord[] {
    return this.rawDataBuffer
      .filter(r => r.lockerId === lockerId)
      .slice(-limit);
  }

  getRecordsByType(type: RawDataType, limit: number = 50): RawDataRecord[] {
    return this.rawDataBuffer
      .filter(r => r.type === type)
      .slice(-limit);
  }
}

export const dataCollector = new DataCollector();
