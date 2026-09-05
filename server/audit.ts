import fs from 'fs';
import path from 'path';

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RECONCILE' | 'SETTLE';
  entityType: 'TRANSACTION' | 'BALANCE' | 'ORDER' | 'SETTLEMENT' | 'SETTINGS';
  entityId: string;
  actor: string;
  description: string;
  previousValue?: any;
  newValue?: any;
}

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const AUDIT_FILE = path.join(DATA_DIR, 'audit_trail.json');

function loadAuditLogs(): AuditRecord[] {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const data = fs.readFileSync(AUDIT_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn('Could not read audit file:', e);
  }
  return [];
}

let auditStore: AuditRecord[] = loadAuditLogs();

function persistAuditLogs() {
  try {
    // Keep last 1,000 entries for maximum history without bloating
    if (auditStore.length > 1000) {
      auditStore = auditStore.slice(0, 1000);
    }
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(auditStore, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write audit file:', e);
  }
}

export const auditService = {
  log(record: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord {
    const entry: AuditRecord = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...record
    };

    auditStore.unshift(entry);
    persistAuditLogs();
    return entry;
  },

  getAll(options?: { entityType?: string; entityId?: string; limit?: number }): AuditRecord[] {
    let list = [...auditStore];
    if (options?.entityType) {
      list = list.filter(a => a.entityType === options.entityType);
    }
    if (options?.entityId) {
      list = list.filter(a => a.entityId === options.entityId);
    }
    if (options?.limit) {
      list = list.slice(0, options.limit);
    }
    return list;
  }
};
