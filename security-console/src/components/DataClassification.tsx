import dataClassificationJson from '../data/data-classification.json';
import type { DataClassification } from '../lib/types';
import { FileText, Lock, Unlock, ShieldAlert } from 'lucide-react';

const headings = [
  'Data item',
  'Example field',
  'Why',
  'Data owner',
  'Who may write',
  'Storage location',
  'Retention',
  'Key safeguards',
  'On-chain? (Y/N)',
  'Evidence/status',
  'Tier',
] as const;

export default function DataClassification() {
  const data = dataClassificationJson as DataClassification[];

  const getClassColor = (tier: string) => {
    switch (tier) {
      case 'Public':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
      case 'Private':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
      case 'Confidential':
        return 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300';
      case 'Restricted':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
    }
  };

  const getClassIcon = (tier: string) => {
    if (tier === 'Public') return <Unlock size={14} />;
    if (tier === 'Restricted') return <ShieldAlert size={14} />;
    if (tier === 'Private' || tier === 'Confidential') return <Lock size={14} />;
    return <FileText size={14} />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Data Classification</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Classification of authentication, requests, reviews, ledger, and audit data.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>{headings.map((heading) => <th key={heading} className="px-4 py-3 text-left font-medium">{heading}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {data.map((item) => (
              <tr key={item['Data item']} className="align-top hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3 font-medium">{item['Data item']}</td>
                <td className="px-4 py-3">{item['Example field']}</td>
                <td className="px-4 py-3">{item.Why}</td>
                <td className="px-4 py-3">{item['Data owner']}</td>
                <td className="px-4 py-3">{item['Who may write']}</td>
                <td className="px-4 py-3">{item['Storage location']}</td>
                <td className="px-4 py-3">{item["Retention"]}</td>
                <td className="px-4 py-3">{item['Key safeguards']}</td>
                <td className="px-4 py-3">{item['On-chain? (Y/N)']}</td>
                <td className="px-4 py-3">{item['Evidence/status']}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${getClassColor(item.tier)}`}>
                    {getClassIcon(item.tier)}{item.tier}
                  </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center">No classification data available</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
        Password hashes and session tokens are managed by Firebase Authentication and are never readable by this application. Scheduled retention actions require deployed Cloud Functions.
      </div>
    </div>
  );
}
