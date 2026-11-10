import { useState, useEffect } from 'react';
import { listUserRoles, setUserRole } from '../lib/firebase';
import type { User } from '../lib/types';
import { Search, Shield, UserPlus, UserMinus, AlertCircle } from 'lucide-react';

export default function Roles() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    user: User;
    role: string;
    action: 'grant' | 'revoke';
  } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const result = await listUserRoles();
      setUsers(result.data.users || []);
    } catch (error: any) {
      setError(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (user: User, role: string, action: 'grant' | 'revoke') => {
    setConfirmDialog({ user, role, action });
  };

  const confirmRoleChange = async () => {
    if (!confirmDialog) return;

    const { user, role, action } = confirmDialog;
    setActionInProgress(user.uid);
    setError('');
    setSuccess('');

    try {
      await setUserRole(user.uid, role, action);
      setSuccess(`Successfully ${action}ed ${role} role to ${user.full_name || user.uid}`);
      await loadUsers();
    } catch (error: any) {
      setError(error.message || `Failed to ${action} role`);
    } finally {
      setActionInProgress(null);
      setConfirmDialog(null);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.uid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600 dark:text-slate-400">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">User Roles</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Manage admin and mechanic roles. Security Admin role cannot be granted or revoked.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search by name or UID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Users table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  UID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center">
                        <Shield className="text-slate-500 dark:text-slate-400" size={16} />
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {user.full_name || 'Unnamed'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      {user.uid.slice(0, 8)}...
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className={`text-xs px-2 py-1 rounded font-medium ${
                            role === 'security_admin'
                              ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                              : role === 'admin'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                              : role === 'mechanic'
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!user.roles.includes('admin') && (
                        <button
                          onClick={() => handleRoleChange(user, 'admin', 'grant')}
                          disabled={actionInProgress === user.uid}
                          className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors text-blue-600 dark:text-blue-400 disabled:opacity-50 min-h-[36px] min-w-[36px]"
                          title="Grant admin"
                          aria-label={`Grant admin to ${user.full_name}`}
                        >
                          <UserPlus size={16} />
                        </button>
                      )}
                      {user.roles.includes('admin') && (
                        <button
                          onClick={() => handleRoleChange(user, 'admin', 'revoke')}
                          disabled={actionInProgress === user.uid}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors text-red-600 dark:text-red-400 disabled:opacity-50 min-h-[36px] min-w-[36px]"
                          title="Revoke admin"
                          aria-label={`Revoke admin from ${user.full_name}`}
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                      {!user.roles.includes('mechanic') && (
                        <button
                          onClick={() => handleRoleChange(user, 'mechanic', 'grant')}
                          disabled={actionInProgress === user.uid}
                          className="p-2 hover:bg-green-100 dark:hover:bg-green-900 rounded-lg transition-colors text-green-600 dark:text-green-400 disabled:opacity-50 min-h-[36px] min-w-[36px]"
                          title="Grant mechanic"
                          aria-label={`Grant mechanic to ${user.full_name}`}
                        >
                          <UserPlus size={16} />
                        </button>
                      )}
                      {user.roles.includes('mechanic') && (
                        <button
                          onClick={() => handleRoleChange(user, 'mechanic', 'revoke')}
                          disabled={actionInProgress === user.uid}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors text-red-600 dark:text-red-400 disabled:opacity-50 min-h-[36px] min-w-[36px]"
                          title="Revoke mechanic"
                          aria-label={`Revoke mechanic from ${user.full_name}`}
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Confirm Role Change
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to {confirmDialog.action} the <strong>{confirmDialog.role}</strong> role
              to <strong>{confirmDialog.user.full_name || confirmDialog.user.uid}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleChange}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[44px]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
