import { useState, useEffect } from 'react';
import dataClassificationJson from '../data/data-classification.json';
import type { DataClassification } from '../lib/types';
import { FileText, Lock, Unlock, ShieldAlert } from 'lucide-react';

export default function DataClassification() {
  const [data, setData] = useState<DataClassification[]>([]);

  useEffect(() => {
    setData(dataClassificationJson as DataClassification[]);
  }, []);

  const getClassColor = (cls: string) => {
    switch (cls) {
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

  const getClassIcon = (cls: string) => {
    switch (cls) {
      case 'Public':
        return <Unlock size={14} />;
      case 'Private':
        return <Lock size={14} />;
      case 'Confidential':
        return <Lock size={14} />;
      case 'Restricted':
        return <ShieldAlert size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Data Classification</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Classification of data fields collected by the application
        </p>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Classification Levels</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className={`px-2 py-1 rounded ${getClassColor('Public')}`}>
              <Unlock size={12} className="inline mr-1" />
              Public
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`px-2 py-1 rounded ${getClassColor('Private')}`}>
              <Lock size={12} className="inline mr-1" />
              Private
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`px-2 py-1 rounded ${getClassColor('Confidential')}`}>
              <Lock size={12} className="inline mr-1" />
              Confidential
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`px-2 py-1 rounded ${getClassColor('Restricted')}`}>
              <ShieldAlert size={12} className="inline mr-1" />
              Restricted
            </span>
          </div>
        </div>
      </div>

      {/* Classification table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">
                  Field
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">
                  Classification
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">
                  Owner
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">
                  Retention Period
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">
                  Safeguard
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {data.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {item.field}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getClassColor(
                        item.class
                      )}`}
                    >
                      {getClassIcon(item.class)}
                      {item.class}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.owner}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.retention}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.safeguard}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No classification data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> This classification is based on the workbook "AutoHelp_PartC_Cybersecurity.xlsx",
          sheet "1 Data Classification". Any discrepancies should be resolved by updating the source workbook.
        </p>
      </div>
    </div>
  );
}
