import React from 'react';
import {
  ShieldCheck,
  Building2,
  LogOut,
  User,
  Shield,
  Layers,
  MapPin,
  Clock,
} from 'lucide-react';
import { CurrentUserSession } from '../../types';

interface NavbarProps {
  session: CurrentUserSession;
  onLogout: () => void;
  onSwitchRole: (role: 'ADMIN' | 'GUARD') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  onLogout,
  onSwitchRole,
}) => {
  const isAdmin = session.role === 'ADMIN';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-emerald-600 to-sky-600 rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                GatePass Pro
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800">
                Guard-Operated
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Industrial Factory Attendance & Payroll System
            </p>
          </div>
        </div>

        {/* Right side: Session Info & Actions */}
        <div className="flex items-center gap-3">
          
          {/* Active User Badge */}
          <div className="hidden md:flex items-center gap-2.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            <div className={`p-1.5 rounded-lg ${isAdmin ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
              {isAdmin ? <Shield className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div className="text-left text-xs">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>{session.name}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${isAdmin ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {isAdmin ? 'ADMIN' : session.guardCode || 'GUARD'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                {isAdmin ? 'Full Factory Access' : session.gate || 'Gate 1 – Main'}
              </div>
            </div>
          </div>

          {/* Quick Role Switcher for Test / Demo Evaluation */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => onSwitchRole('GUARD')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                !isAdmin
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch view to Guard Attendance Gate Terminal"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Gate Terminal</span>
            </button>

            <button
              onClick={() => onSwitchRole('ADMIN')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                isAdmin
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch view to Admin Management & Payroll Portal"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Log out session"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </div>
    </header>
  );
};
