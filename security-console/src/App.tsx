import { useState, useEffect } from 'react';
import { onAuthChange, signOut, getSecurityPolicy, recordSecurityConsoleAccess } from './lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import SignIn from './components/SignIn';
import Overview from './components/Overview';
import Roles from './components/Roles';
import PermissionMatrix from './components/PermissionMatrix';
import AuditLog from './components/AuditLog';
import DataClassification from './components/DataClassification';
import GDPRChecklist from './components/GDPRChecklist';
import SecuritySettings from './components/SecuritySettings';
import AccessDenied from './components/AccessDenied';
import { Shield, Menu, X, LogOut, User, Moon, Sun } from 'lucide-react';

type Screen = 'overview' | 'roles' | 'permissions' | 'audit' | 'classification' | 'gdpr' | 'settings';

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [hasSecurityAdmin, setHasSecurityAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        try {
          await recordSecurityConsoleAccess();
          await getSecurityPolicy();
          setHasSecurityAdmin(true);
        } catch (error) {
          console.error('Security console access was denied or could not be audited:', error);
          setHasSecurityAdmin(false);
        }
      } else {
        setHasSecurityAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSignOut = async () => {
    await signOut();
    setCurrentScreen('overview');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  if (!hasSecurityAdmin) {
    return <AccessDenied />;
  }

  const hostname = window.location.hostname;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <Shield className="text-blue-600 dark:text-blue-400" size={24} />
            <span className="font-semibold text-lg">Security Console</span>
          </div>
          <span className="hidden sm:inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded">
            Environment: Security
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline-block text-sm text-slate-500 dark:text-slate-400 font-mono">
            {hostname}
          </span>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <User size={20} className="text-slate-500" />
            <span className="text-sm font-medium">{user.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-16 bottom-0 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-transform z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-4 space-y-1">
          {[
            { id: 'overview' as Screen, label: 'Overview' },
            { id: 'roles' as Screen, label: 'Roles' },
            { id: 'permissions' as Screen, label: 'Permission Matrix' },
            { id: 'audit' as Screen, label: 'Audit Log' },
            { id: 'classification' as Screen, label: 'Data Classification' },
            { id: 'gdpr' as Screen, label: 'GDPR Checklist' },
            { id: 'settings' as Screen, label: 'Security Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                currentScreen === item.id
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main
        className={`pt-16 transition-all ${
          sidebarOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        <div className="p-6">
          {currentScreen === 'overview' && <Overview />}
          {currentScreen === 'roles' && <Roles />}
          {currentScreen === 'permissions' && <PermissionMatrix />}
          {currentScreen === 'audit' && <AuditLog />}
          {currentScreen === 'classification' && <DataClassification />}
          {currentScreen === 'gdpr' && <GDPRChecklist />}
          {currentScreen === 'settings' && <SecuritySettings />}
        </div>
      </main>
    </div>
  );
}

export default App;
