import { useState } from 'react';
import securityPolicy from '../../../functions/src/security-policy.json';
import type { SecurityPolicy } from '../lib/types';
import { Check, X } from 'lucide-react';

export default function PermissionMatrix() {
  const policy = securityPolicy as SecurityPolicy;
  const [highlightActor, setHighlightActor] = useState<string | null>(null);

  const getPermissionColor = (value: string) => {
    if (value === 'Full') return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
    if (value === 'Own' || value === 'Assigned') return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
    if (value.includes('fn')) return 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300';
    if (value === 'Priv (fn)') return 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300';
    return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
  };

  const getStatusColor = (status: string) => {
    if (status === 'Enforced') return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
    if (status === 'Partly enforced') return 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300';
    return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Permission Matrix</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Access control matrix for all actors and modules
        </p>
      </div>

      {/* Actor filter */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-400 self-center">Highlight actor:</span>
        {policy.actors.map((actor) => (
          <button
            key={actor}
            onClick={() => setHighlightActor(highlightActor === actor ? null : actor)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              highlightActor === actor
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {actor}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 bg-green-100 dark:bg-green-900 rounded flex items-center justify-center">
              <Check size={10} className="text-green-700 dark:text-green-300" />
            </span>
            <span className="text-slate-600 dark:text-slate-400">Full access</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center">
              <Check size={10} className="text-blue-700 dark:text-blue-300" />
            </span>
            <span className="text-slate-600 dark:text-slate-400">Own/Assigned</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 bg-purple-100 dark:bg-purple-900 rounded flex items-center justify-center text-xs font-mono">
              fn
            </span>
            <span className="text-slate-600 dark:text-slate-400">Via function</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center">
              <X size={10} className="text-slate-700 dark:text-slate-300" />
            </span>
            <span className="text-slate-600 dark:text-slate-400">No access</span>
          </div>
        </div>
      </div>

      {/* Matrix table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50">
                <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-700/50 z-10 min-w-[180px]">
                  Module
                </th>
                {policy.actors.map((actor) => (
                  <th
                    key={actor}
                    className={`px-4 py-3 text-center font-medium min-w-[100px] ${
                      highlightActor === actor
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {actor}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-medium text-slate-700 dark:text-slate-300 min-w-[100px]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {policy.modules.map((module) => {
                const status = policy.permissions.find((p) => p.module === module.id)?.status || 'Unknown';

                return (
                  <tr key={module.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-800">
                      {module.name}
                    </td>
                    {policy.actors.map((actor) => {
                      const perm = policy.permissions.find((p) => p.actor === actor && p.module === module.id);
                      return (
                        <td
                          key={actor}
                          className={`px-4 py-3 text-center ${
                            highlightActor === actor ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className="flex flex-col gap-1 items-center">
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${getPermissionColor(perm?.read || 'None')}`}
                            >
                              R: {perm?.read || 'None'}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${getPermissionColor(perm?.write || 'None')}`}
                            >
                              W: {perm?.write || 'None'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(status)}`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
