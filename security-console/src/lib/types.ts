export interface User {
  uid: string;
  full_name: string;
  roles: string[];
}

export interface AuditEntry {
  id: string;
  actor_uid: string;
  action: string;
  target_uid: string | null;
  role_changed: string | null;
  result: 'Allowed' | 'Denied';
  reason: string;
  timestamp: number;
  record_ref?: string;
  before_status?: string;
  after_status?: string;
}

export interface Permission {
  actor: string;
  module: string;
  read: string;
  write: string;
  status: string;
}

export interface SecurityPolicy {
  actors: string[];
  modules: { name: string; id: string }[];
  permissions: Permission[];
}

export interface DataClassification {
  field: string;
  class: 'Public' | 'Private' | 'Confidential' | 'Restricted';
  owner: string;
  retention: string;
  safeguard: string;
}

export interface GDPRItem {
  requirement: string;
  level_today: string;
  target: string;
  gap: string;
  action: string;
  priority: 'High' | 'Medium' | 'Low';
}
