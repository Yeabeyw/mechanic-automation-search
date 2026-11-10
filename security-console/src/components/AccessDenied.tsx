import { signOut } from '../lib/firebase';
import { ShieldX, LogOut, Home } from 'lucide-react';

export default function AccessDenied() {
  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
          <div className="p-4 bg-red-100 dark:bg-red-900 rounded-full mx-auto mb-6 w-fit">
            <ShieldX className="text-red-600 dark:text-red-400" size={48} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Access Denied
          </h1>

          <p className="text-slate-600 dark:text-slate-400 mb-6">
            You do not have the required <strong>Security Administrator</strong> role to access this
            console. This security console is restricted to authorized security personnel only.
          </p>

          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Required Role:</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <code className="bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded">security_admin</code>
            </p>
            <h3 className="font-medium text-slate-900 dark:text-slate-100 mt-4 mb-2">Current Hostname:</h3>
            <p className="text-sm font-mono text-slate-600 dark:text-slate-400">
              {window.location.hostname}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            >
              <LogOut size={18} />
              Sign Out
            </button>
            <a
              href="/"
              className="w-full py-3 px-4 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            >
              <Home size={18} />
              Return to Main App
            </a>
          </div>

          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            If you believe this is an error, contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
