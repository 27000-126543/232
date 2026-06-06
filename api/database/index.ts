import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'locker_operation.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`[Database] SQLite数据库已连接: ${DB_PATH}`);

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lockers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 36,
      region TEXT NOT NULL,
      region_id TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT,
      operator TEXT,
      install_date TEXT,
      status TEXT NOT NULL DEFAULT 'online',
      lat REAL,
      lng REAL,
      today_usage REAL DEFAULT 0,
      today_turnover REAL DEFAULT 0,
      avg_pickup_time REAL DEFAULT 45,
      avg_fault_recovery REAL DEFAULT 60,
      current_usage REAL DEFAULT 0,
      last_fault_time TEXT,
      last_update_time TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      locker_id TEXT NOT NULL,
      event_time TEXT NOT NULL,
      data_json TEXT,
      received_at TEXT NOT NULL,
      is_valid INTEGER DEFAULT 1,
      processed INTEGER DEFAULT 0,
      processed_at TEXT,
      FOREIGN KEY (locker_id) REFERENCES lockers(id)
    );

    CREATE TABLE IF NOT EXISTS hourly_usage (
      id TEXT PRIMARY KEY,
      locker_id TEXT NOT NULL,
      date TEXT NOT NULL,
      hour INTEGER NOT NULL,
      usage_rate REAL DEFAULT 0,
      pickup_count INTEGER DEFAULT 0,
      delivery_count INTEGER DEFAULT 0,
      scan_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (locker_id) REFERENCES lockers(id),
      UNIQUE(locker_id, date, hour)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      locker_id TEXT NOT NULL,
      locker_name TEXT NOT NULL,
      region TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      type TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      handled_at TEXT,
      handled_by TEXT,
      last_checked_at TEXT,
      escalated_at TEXT,
      FOREIGN KEY (locker_id) REFERENCES lockers(id)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      alert_id TEXT,
      locker_name TEXT NOT NULL,
      type TEXT NOT NULL,
      type_name TEXT,
      current_step INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      description TEXT,
      created_at TEXT NOT NULL,
      created_from_alert TEXT,
      auto_escalated INTEGER DEFAULT 0,
      escalation_time TEXT,
      step1_deadline TEXT,
      step2_deadline TEXT,
      step3_deadline TEXT,
      step1_approver TEXT,
      step1_opinion TEXT,
      step1_approved INTEGER,
      step1_approved_at TEXT,
      step2_approver TEXT,
      step2_opinion TEXT,
      step2_approved INTEGER,
      step2_approved_at TEXT,
      step3_approver TEXT,
      step3_opinion TEXT,
      step3_approved INTEGER,
      step3_approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS community_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      community TEXT NOT NULL,
      region TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      estimated_foot_traffic INTEGER DEFAULT 500,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fault_records (
      id TEXT PRIMARY KEY,
      locker_id TEXT NOT NULL,
      fault_type TEXT NOT NULL,
      fault_level TEXT,
      error_code TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      resolved INTEGER DEFAULT 0,
      resolved_by TEXT,
      resolution_note TEXT,
      FOREIGN KEY (locker_id) REFERENCES lockers(id)
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id TEXT PRIMARY KEY,
      week TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_lockers INTEGER NOT NULL DEFAULT 0,
      total_pickups INTEGER NOT NULL DEFAULT 0,
      avg_usage REAL NOT NULL DEFAULT 0,
      avg_usage_yoy REAL NOT NULL DEFAULT 0,
      avg_usage_wow REAL NOT NULL DEFAULT 0,
      fault_types_json TEXT,
      restock_efficiency_json TEXT,
      recommendations_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_raw_events_locker ON raw_events(locker_id);
    CREATE INDEX IF NOT EXISTS idx_raw_events_type ON raw_events(type);
    CREATE INDEX IF NOT EXISTS idx_raw_events_time ON raw_events(event_time);
    CREATE INDEX IF NOT EXISTS idx_hourly_usage_locker ON hourly_usage(locker_id, date);
    CREATE INDEX IF NOT EXISTS idx_alerts_locker ON alerts(locker_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_lockers_region ON lockers(region_id);
    CREATE INDEX IF NOT EXISTS idx_lockers_status ON lockers(status);
  `);

  console.log('[Database] 数据表创建完成');
}

export default db;
