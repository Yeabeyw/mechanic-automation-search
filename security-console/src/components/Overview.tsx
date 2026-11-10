import { useEffect, useState } from 'react';
import { listUserRoles, listAuditLog } from '../lib/firebase';
import type { User, AuditEntry } from '../lib/types';
import { Users, ShieldCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function Overview() {
  const [users, setUsers] = useState<User[]>([]);
  const [recentAudits, setRecentAudits] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [usersResult, auditResult] = await Promise.all([
          listUserRoles(),
          listAuditLog({ limit: 10 }),
        ]);
        setUsers(usersResult.data.users || []);
        setRecentAudits(auditResult.data.entries || []);
      } catch (error) {
        console.error('Failed to load overview data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const roleCounts = users.reduce((acc, user) => {
    user.roles.forEach((role) => {
      acc[role] = (acc[role] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const allowedCount = recentAudits.filter((a) => a.result === 'Allowed').length;
  const deniedCount = recentAudits.filter((a) => a.result === 'Denied').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600 dark:text-slate-400">Loading overview...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Overview</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Security console dashboard</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Users</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <ShieldCheck className="text-green-600 dark:text-green-400" size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Security Admins</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {roleCounts.security_admin || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Allowed Actions</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{allowedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <XCircle className="text-red-600 dark:text-red-400" size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Denied Actions</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{deniedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Role distribution */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Role Distribution</h2>
        <div className="space-y-3">
          {Object.entries(roleCounts).map(([role, count]) => (
            <div key={role} className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300 capitalize">{role}</span>
              <span className="font-mono text-sm bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                {count}
              </span>
            </div>
          ))}
          {Object.keys(roleCounts).length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No users found</p>
          )}
        </div>
      </div>

      {/* Recent audit log */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Audit Events</h2>
          <Clock className="text-slate-400" size={18} />
        </div>
        {recentAudits.length > 0 ? (
          <div className="space-y-2">
            {recentAudits.map((audit) => (
              <div
                key={audit.id}
                className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {audit.result === 'Allowed' ? (
                    <CheckCircle2 className="text-green-600 dark:text-green-400" size={16} />
                  ) : (
                    <XCircle className="text-red-600 dark:text-red-400" size={16} />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{audit.action}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {new Date(audit.timestamp * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    audit.result === 'Allowed'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  }`}
                >
                  {audit.result}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-sm">No audit events recorded</p>
        )}
      </div>
    </div>
  );
}
