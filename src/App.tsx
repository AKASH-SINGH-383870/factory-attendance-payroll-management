import React, { useState, useEffect } from 'react';
import { CurrentUserSession, Role } from './types';
import { StorageService } from './services/storage';
import { LoginScreen } from './components/auth/LoginScreen';
import { Navbar } from './components/common/Navbar';
import { GuardAttendanceTerminal } from './components/guard/GuardAttendanceTerminal';
import { AdminDashboard } from './components/admin/AdminDashboard';

export default function App() {
  const [session, setSession] = useState<CurrentUserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session from storage
  useEffect(() => {
    const saved = StorageService.getSession();
    if (saved) {
      setSession(saved);
    }
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = (newSession: CurrentUserSession) => {
    setSession(newSession);
    StorageService.setSession(newSession);
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('gatepass_session');
  };

  const handleSwitchRole = (newRole: Role) => {
    if (!session) return;
    if (newRole === 'GUARD') {
      const guardSession: CurrentUserSession = {
        role: 'GUARD',
        id: 'guard-1',
        name: 'Ramesh Kumar',
        username: 'guard01',
        guardCode: 'G-101',
        gate: 'Gate 1 – Main Gate North',
        factory: 'Plant Complex A – Manufacturing Unit',
      };
      setSession(guardSession);
      StorageService.setSession(guardSession);
    } else {
      const adminSession: CurrentUserSession = {
        role: 'ADMIN',
        id: 'admin-1',
        name: 'Factory Superintendent / HR Admin',
        username: 'admin',
      };
      setSession(adminSession);
      StorageService.setSession(adminSession);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-mono text-slate-400">Loading GatePass Terminal...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      
      {/* Top Application Header */}
      <Navbar
        session={session}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {session.role === 'GUARD' ? (
          <GuardAttendanceTerminal
            guardSession={session}
          />
        ) : (
          <AdminDashboard
            session={session}
            onSwitchToGuardTerminal={() => handleSwitchRole('GUARD')}
          />
        )}
      </main>

      {/* Industrial Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>GatePass Pro • Industrial Guard-Operated Attendance & Payroll System</span>
          <span className="font-mono text-[11px]">Strict Role Accountability: Guard Gate Verification Active</span>
        </div>
      </footer>

    </div>
  );
}
