import { useState, useEffect, useCallback } from 'react';
import { listAuditLog } from '../lib/firebase';
import type { AuditEntry } from '../lib/types';
import { Filter, CheckCircle2, XCircle, ChevronDown, ChevronUp, Copy, Download } from 'lucide-react';

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterActor, setFilterActor] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterResult, setFilterResult] = useState<'Allowed' | 'Denied' | ''>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAuditLog({
        limit: 50,
        filterActor: filterActor || undefined,
        filterAction: filterAction || undefined,
        filterResult: filterResult || undefined,
      });
      setEntries(result.data.entries || []);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    } finally {
      setLoading(false);
    }
  }, [filterActor, filterAction, filterResult]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const exportCsv = () => {
    const columns = ['timestamp', 'actor_uid', 'action', 'target_uid', 'role_changed', 'result', 'reason', 'record_ref', 'before_status', 'after_status'];
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [columns, ...entries.map((entry) => columns.map((column) => entry[column as keyof AuditEntry] ?? ''))];
    const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `autohelp-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600 dark:text-slate-400">Loading audit log...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit Log</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Security events and role changes (append-only, newest first)
        </p>
        <button type="button" onClick={exportCsv} disabled={entries.length === 0} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
          <Download size={16} /> Export filtered entries as CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-slate-500" />
          <span className="font-medium text-slate-900 dark:text-slate-100">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Filter by actor UID..."
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          />
          <input
            type="text"
            placeholder="Filter by action..."
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          />
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value as 'Allowed' | 'Denied' | '')}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          >
            <option value="">All results</option>
            <option value="Allowed">Allowed</option>
            <option value="Denied">Denied</option>
          </select>
        </div>
      </div>

      {/* Audit entries */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {entries.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {entries.map((entry) => (
              <div key={entry.id}>
                <div
                  className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {entry.result === 'Allowed' ? (
                        <CheckCircle2 className="text-green-600 dark:text-green-400 flex-shrink-0" size={18} />
                      ) : (
                        <XCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={18} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {entry.action}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {formatDate(entry.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          entry.result === 'Allowed'
                            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {entry.result}
                      </span>
                      {expandedRow === entry.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {expandedRow === entry.id && (
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Actor UID:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="font-mono text-slate-900 dark:text-slate-100">
                            {entry.actor_uid}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(entry.actor_uid);
                            }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                            aria-label="Copy UID"
                          >
                            <Copy size={14} className="text-slate-500" />
                          </button>
                        </div>
                      </div>
                      {entry.target_uid && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Target UID:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="font-mono text-slate-900 dark:text-slate-100">
                              {entry.target_uid}
                            </code>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(entry.target_uid ?? '');
                              }}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                              aria-label="Copy UID"
                            >
                              <Copy size={14} className="text-slate-500" />
                            </button>
                          </div>
                        </div>
                      )}
                      {entry.role_changed && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Role Changed:</span>
                          <p className="font-mono text-slate-900 dark:text-slate-100 mt-1">
                            {entry.role_changed}
                          </p>
                        </div>
                      )}
                      {entry.record_ref && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Record Ref:</span>
                          <p className="font-mono text-slate-900 dark:text-slate-100 mt-1">
                            {entry.record_ref}
                          </p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-slate-500 dark:text-slate-400">Reason:</span>
                        <p className="text-slate-900 dark:text-slate-100 mt-1">{entry.reason}</p>
                      </div>
                      {entry.before_status && entry.after_status && (
                        <div className="col-span-2">
                          <span className="text-slate-500 dark:text-slate-400">Status Change:</span>
                          <p className="text-slate-900 dark:text-slate-100 mt-1">
                            {entry.before_status} → {entry.after_status}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
            No audit entries found
          </div>
        )}
      </div>
    </div>
  );
}
