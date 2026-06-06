import { db } from './index.js';

const regions = [
  { id: 'region-1', name: '华东区', cities: ['上海', '南京', '杭州', '苏州', '宁波'] },
  { id: 'region-2', name: '华北区', cities: ['北京', '天津', '石家庄', '济南', '青岛'] },
  { id: 'region-3', name: '华南区', cities: ['广州', '深圳', '佛山', '东莞', '厦门'] },
  { id: 'region-4', name: '华中区', cities: ['武汉', '长沙', '郑州', '南昌', '合肥'] },
  { id: 'region-5', name: '西南区', cities: ['成都', '重庆', '贵阳', '昆明', '南宁'] },
];

const communities = [
  '万科城市花园', '保利中央公园', '华润橡树湾', '碧桂园凤凰城', '恒大华府',
  '绿地中心', '龙湖天街', '融创滨江壹号', '金地自在城', '招商依云郡',
];

const models = ['Smart-L300', 'Smart-L500', 'Smart-L800', 'Mini-M200'];

function generateLockers() {
  const lockers: any[] = [];
  let id = 1;

  regions.forEach(region => {
    region.cities.forEach(city => {
      for (let i = 0; i < 10; i++) {
        const community = communities[Math.floor(Math.random() * communities.length)];
        const model = models[Math.floor(Math.random() * models.length)];
        const capacity = model === 'Mini-M200' ? 24 : model === 'Smart-L300' ? 36 : model === 'Smart-L500' ? 48 : 72;
        const status = Math.random() > 0.1 ? 'online' : (Math.random() > 0.5 ? 'fault' : 'offline');
        const now = new Date().toISOString();

        lockers.push({
          id: `locker-${id.toString().padStart(3, '0')}`,
          code: `LK${region.id.split('-')[1]}${city.charAt(0)}${id.toString().padStart(3, '0')}`,
          name: `${city}${community}柜${i + 1}`,
          model,
          capacity,
          region: region.name,
          region_id: region.id,
          city,
          address: `${city}${community}${i + 1}号门`,
          operator: ['顺丰速运', '菜鸟驿站', '京东物流', '丰巢科技'][Math.floor(Math.random() * 4)],
          install_date: new Date(2023 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
          status,
          lat: 30 + Math.random() * 10,
          lng: 110 + Math.random() * 15,
          today_usage: Math.random() * 60 + 20,
          today_turnover: Math.random() * 4 + 1,
          avg_pickup_time: Math.random() * 60 + 30,
          avg_fault_recovery: Math.random() * 120 + 30,
          current_usage: Math.random() * 80 + 10,
          last_fault_time: null,
          last_update_time: now,
          created_at: now,
        });
        id++;
      }
    });
  });

  return lockers;
}

function generateRawEvents(lockers: any[]) {
  const events: any[] = [];
  const types = ['pickup', 'delivery', 'fault', 'restock', 'scan'];
  const weights = [0.4, 0.25, 0.05, 0.1, 0.2];
  const now = Date.now();

  for (let i = 0; i < 500; i++) {
    const locker = lockers[Math.floor(Math.random() * lockers.length)];
    let random = Math.random();
    let type = 'pickup';
    let cumulative = 0;
    for (let j = 0; j < types.length; j++) {
      cumulative += weights[j];
      if (random < cumulative) {
        type = types[j];
        break;
      }
    }

    const eventTime = new Date(now - Math.floor(Math.random() * 4 * 3600000));
    let data: any = {};

    switch (type) {
      case 'pickup':
        data = {
          trackingNo: `SF${Math.floor(Math.random() * 10000000000)}`,
          compartment: Math.floor(Math.random() * locker.capacity) + 1,
          duration: Math.floor(Math.random() * 180) + 10,
          userId: `user_${Math.floor(Math.random() * 10000)}`,
        };
        break;
      case 'delivery':
        data = {
          trackingNo: `YD${Math.floor(Math.random() * 10000000000)}`,
          compartment: Math.floor(Math.random() * locker.capacity) + 1,
          courierId: `courier_${Math.floor(Math.random() * 500)}`,
          size: ['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)],
        };
        break;
      case 'fault':
        data = {
          faultType: ['door_stuck', 'screen_failure', 'network_error', 'payment_failure', 'system_crash'][Math.floor(Math.random() * 5)],
          faultLevel: Math.random() > 0.3 ? 'minor' : 'major',
          errorCode: `ERR-${Math.floor(Math.random() * 1000)}`,
        };
        break;
      case 'restock':
        data = {
          operatorId: `op_${Math.floor(Math.random() * 100)}`,
          beforeCount: Math.floor(Math.random() * 20),
          afterCount: Math.floor(Math.random() * 15) + 20,
          duration: Math.floor(Math.random() * 600) + 60,
        };
        break;
      case 'scan':
        data = {
          userId: `user_${Math.floor(Math.random() * 10000)}`,
          action: ['open_door', 'query', 'payment', 'bind'][Math.floor(Math.random() * 4)],
          deviceType: ['ios', 'android', 'mini_program'][Math.floor(Math.random() * 3)],
        };
        break;
    }

    events.push({
      id: `raw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`,
      type,
      locker_id: locker.id,
      event_time: eventTime.toISOString(),
      data_json: JSON.stringify(data),
      received_at: eventTime.toISOString(),
      is_valid: 1,
      processed: 0,
      processed_at: null,
    });
  }

  return events;
}

function generateFaultRecords(lockers: any[]) {
  const faults: any[] = [];
  
  lockers.filter(l => l.status === 'fault').forEach(locker => {
    const startTime = new Date(Date.now() - Math.floor(Math.random() * 4 * 3600000));
    faults.push({
      id: `fault_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      locker_id: locker.id,
      fault_type: ['door_stuck', 'screen_failure', 'network_error'][Math.floor(Math.random() * 3)],
      fault_level: 'major',
      error_code: `ERR-${Math.floor(Math.random() * 1000)}`,
      start_time: startTime.toISOString(),
      end_time: null,
      resolved: 0,
      resolved_by: null,
      resolution_note: null,
    });
  });

  return faults;
}

export function seedDatabase() {
  const lockerCount = db.prepare('SELECT COUNT(*) as count FROM lockers').get() as any;
  
  if (lockerCount.count > 0) {
    console.log('[Database] 数据库已存在数据，跳过种子数据初始化');
    return;
  }

  const insertLocker = db.prepare(`
    INSERT INTO lockers (
      id, code, name, model, capacity, region, region_id, city, address,
      operator, install_date, status, lat, lng, today_usage, today_turnover,
      avg_pickup_time, avg_fault_recovery, current_usage, last_fault_time,
      last_update_time, created_at
    ) VALUES (
      @id, @code, @name, @model, @capacity, @region, @region_id, @city, @address,
      @operator, @install_date, @status, @lat, @lng, @today_usage, @today_turnover,
      @avg_pickup_time, @avg_fault_recovery, @current_usage, @last_fault_time,
      @last_update_time, @created_at
    )
  `);

  const insertEvent = db.prepare(`
    INSERT INTO raw_events (
      id, type, locker_id, event_time, data_json, received_at, is_valid, processed, processed_at
    ) VALUES (
      @id, @type, @locker_id, @event_time, @data_json, @received_at, @is_valid, @processed, @processed_at
    )
  `);

  const insertFault = db.prepare(`
    INSERT INTO fault_records (
      id, locker_id, fault_type, fault_level, error_code, start_time,
      end_time, resolved, resolved_by, resolution_note
    ) VALUES (
      @id, @locker_id, @fault_type, @fault_level, @error_code, @start_time,
      @end_time, @resolved, @resolved_by, @resolution_note
    )
  `);

  const lockers = generateLockers();
  const events = generateRawEvents(lockers);
  const faults = generateFaultRecords(lockers);

  const tx = db.transaction(() => {
    lockers.forEach(locker => insertLocker.run(locker));
    events.forEach(event => insertEvent.run(event));
    faults.forEach(fault => insertFault.run(fault));
  });

  tx();

  console.log(`[Database] 种子数据初始化完成: ${lockers.length}台柜机, ${events.length}条事件记录, ${faults.length}条故障记录`);
}

export default seedDatabase;
