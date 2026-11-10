import { useState, useEffect } from 'react';
import gdprData from '../data/gdpr-checklist.json';
import type { GDPRItem } from '../lib/types';
import { CheckCircle2, AlertTriangle, XCircle, Circle } from 'lucide-react';

export default function GDPRChecklist() {
  const [items, setItems] = useState<GDPRItem[]>([]);

  useEffect(() => {
    setItems(gdprData as GDPRItem[]);
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Compliant':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
      case 'Partially compliant':
        return 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300';
      case 'Non-compliant':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'Compliant':
        return <CheckCircle2 size={14} />;
      case 'Partially compliant':
        return <AlertTriangle size={14} />;
      case 'Non-compliant':
        return <XCircle size={14} />;
      default:
        return <Circle size={14} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
      case 'Medium':
        return 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300';
      case 'Low':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
    }
  };

  const compliantCount = items.filter((i) => i.level_today === 'Compliant').length;
  const partiallyCompliantCount = items.filter((i) => i.level_today === 'Partially compliant').length;
  const nonCompliantCount = items.filter((i) => i.level_today === 'Non-compliant').length;
  const total = items.length;
  const score = total === 0 ? 0 : Math.round((compliantCount / total) * 100);

  const overallRating = score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low';

  const groupedByPriority = items.reduce((acc, item) => {
    if (!acc[item.priority]) acc[item.priority] = [];
    acc[item.priority].push(item);
    return acc;
  }, {} as Record<string, GDPRItem[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">GDPR Compliance Checklist</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Educational readiness assessment, not legal certification
        </p>
      </div>

      {/* Overall score */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Overall Compliance Score</h3>
          <span
            className={`px-3 py-1 rounded-lg font-medium ${
              overallRating === 'High'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : overallRating === 'Medium'
                ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
            }`}
          >
            {overallRating}
          </span>
        </div>
        <div className="relative h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-green-500 dark:bg-green-600 transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-slate-600 dark:text-slate-400">
          <span>{score}% Compliant</span>
          <span>{compliantCount}/{total} requirements met</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-green-600 dark:text-green-400" size={24} />
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Compliant</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{compliantCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-600 dark:text-amber-400" size={24} />
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Partially Compliant</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{partiallyCompliantCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <XCircle className="text-red-600 dark:text-red-400" size={24} />
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Non-compliant</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{nonCompliantCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist by priority */}
      {(['High', 'Medium', 'Low'] as const).map((priority) => (
        <div key={priority} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className={`px-4 py-3 border-b border-slate-200 dark:border-slate-700 ${getPriorityColor(priority)}`}>
            <h3 className="font-semibold">{priority} Priority</h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {(groupedByPriority[priority] || []).map((item, index) => (
              <div key={index} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{item.requirement}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Today:</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(
                            item.level_today
                          )}`}
                        >
                          {getLevelIcon(item.level_today)}
                          {item.level_today}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Target:</span>
                        <span className="text-slate-700 dark:text-slate-300">{item.target}</span>
                      </div>
                      {item.gap && (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-500 dark:text-slate-400">Gap:</span>
                          <span className="text-slate-700 dark:text-slate-300">{item.gap}</span>
                        </div>
                      )}
                      {item.action && (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-500 dark:text-slate-400">Action:</span>
                          <span className="text-slate-700 dark:text-slate-300">{item.action}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(!groupedByPriority[priority] || groupedByPriority[priority].length === 0) && (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                No {priority.toLowerCase()} priority items
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Disclaimer:</strong> This checklist is an educational readiness assessment and does not constitute
          legal certification of GDPR compliance. Consult with legal counsel for formal compliance verification.
        </p>
      </div>
    </div>
  );
}
