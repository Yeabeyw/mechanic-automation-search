import { Shield, Lock, Clock, Globe, AlertTriangle } from 'lucide-react';

export default function SecuritySettings() {
  const customDomain = 'security.example.com';
  const domainStatus: string = 'pending';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Security Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Security configuration and domain status
        </p>
      </div>

      {/* Custom domain status */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="text-slate-500" size={20} />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Custom Domain Status</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Custom Domain:</span>
            <code className="font-mono text-sm text-slate-900 dark:text-slate-100">{customDomain}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Status:</span>
            <span
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                domainStatus === 'active'
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : domainStatus === 'pending'
                  ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {domainStatus === 'active' ? 'Active' : domainStatus === 'pending' ? 'Pending DNS' : 'Not Configured'}
            </span>
          </div>
          {domainStatus === 'pending' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-medium mb-2">DNS Configuration Required</p>
                  <p className="mb-2">Add the following DNS records to your domain provider:</p>
                  <div className="space-y-1 font-mono text-xs bg-amber-100 dark:bg-amber-900/30 p-2 rounded">
                    <div>A record: security.example.com → [Firebase IP address]</div>
                    <div>or CNAME: security.example.com → [Firebase hosting domain]</div>
                  </div>
                  <p className="mt-2">
                    After adding DNS records, add this domain to Firebase Console &gt; Auth &gt; Settings &gt;
                    Authorised domains.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MFA status */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="text-slate-500" size={20} />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Multi-Factor Authentication</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Status:</span>
            <span className="px-3 py-1 rounded-lg text-sm font-medium bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
              Not Available (Spark Plan)
            </span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Compensating Control:</strong> Security Admins should enable Google 2-Step Verification
              on their Google account. Firebase Auth on the Spark plan does not support built-in MFA.
            </p>
          </div>
        </div>
      </div>

      {/* Sign-in notes */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="text-slate-500" size={20} />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sign-in Security</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Provider:</span>
            <span className="text-slate-900 dark:text-slate-100">Email/Password</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Session Length:</span>
            <span className="text-slate-900 dark:text-slate-100">Configurable (default: 2 weeks)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Password Policy:</span>
            <span className="text-slate-900 dark:text-slate-100">Enforced by Firebase Auth</span>
          </div>
        </div>
      </div>

      {/* Retention periods */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="text-slate-500" size={20} />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Data Retention Periods</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400">User profiles:</span>
            <span className="text-slate-900 dark:text-slate-100">Until account deletion</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400">Service requests:</span>
            <span className="text-slate-900 dark:text-slate-100">2 years after completion</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400">Reviews:</span>
            <span className="text-slate-900 dark:text-slate-100">Indefinite</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400">Security audit log:</span>
            <span className="text-slate-900 dark:text-slate-100">7 years</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-600 dark:text-slate-400">Ledger blocks:</span>
            <span className="text-slate-900 dark:text-slate-100">Indefinite (immutable)</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong>Note:</strong> These settings are read-only. Changes require Firebase Console access or
          configuration updates in firebase.json and Firestore rules.
        </p>
      </div>
    </div>
  );
}
