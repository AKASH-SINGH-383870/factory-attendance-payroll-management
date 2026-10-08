import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Clock,
  Coins,
  History,
  Sliders,
  Building,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Wallet,
} from 'lucide-react';
import { Worker, CurrentUserSession, AttendanceRulesConfig, AttendanceRecord } from '../../types';
import { StorageService } from '../../services/storage';
import { ApiService } from '../../services/api';
import { WorkerManagement } from './WorkerManagement';
import { GuardManagement } from './GuardManagement';
import { LiveAttendanceView } from './LiveAttendanceView';
import { AttendanceRulesConfigView } from './AttendanceRulesConfig';
import { PayrollManagementView } from './PayrollManagement';
import { ReportsView } from './ReportsView';
import { AuditLogsView } from './AuditLogsView';
import { AdvanceSalaryManagement } from './AdvanceSalaryManagement';
import { formatCurrency } from '../../utils/timeCalculations';

interface AdminDashboardProps {
  session: CurrentUserSession;
  onSwitchToGuardTerminal: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  onSwitchToGuardTerminal,
}) => {
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'WORKERS' | 'GUARDS' | 'ATTENDANCE' | 'REPORTS' | 'ADVANCE' | 'PAYROLL' | 'RULES' | 'AUDIT'
  >('OVERVIEW');

  // Reactive state
  const [workers, setWorkers] = useState<Worker[]>(StorageService.getWorkers());
  const [guards, setGuards] = useState(StorageService.getGuards());
  const [rules, setRules] = useState<AttendanceRulesConfig>(StorageService.getRules());
  const [attendanceToday, setAttendanceToday] = useState<AttendanceRecord[]>(StorageService.getAttendanceForDate());

  const handleRefresh = async () => {
    try {
      const [w, g, r, att] = await Promise.all([
        ApiService.getWorkers(),
        ApiService.getGuards(),
        ApiService.getRules(),
        ApiService.getAttendance({ date: '2026-10-08' }),
      ]);
      setWorkers(w);
      setGuards(g);
      setRules(r);
      setAttendanceToday(att);
    } catch (e) {
      setWorkers(StorageService.getWorkers());
      setGuards(StorageService.getGuards());
      setRules(StorageService.getRules());
      setAttendanceToday(StorageService.getAttendanceForDate());
    }
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  // Quick stats
  const insideCount = attendanceToday.filter(a => a.checkInTime && !a.checkOutTime).length;
  const checkedInCount = attendanceToday.filter(a => a.checkInTime).length;
  const lateCount = attendanceToday.filter(a => a.lateMinutes > 0).length;
  const totalPayrollEst = workers.reduce((acc, w) => acc + (w.monthlySalary || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Admin Navigation Tab Bar */}
      <div className="bg-slate-900 border border-slate-800 p-2 rounded-2xl flex flex-wrap items-center gap-1.5 shadow-lg">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('WORKERS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'WORKERS'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Worker Profiles ({workers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('GUARDS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'GUARDS'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Security Guards ({guards.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ATTENDANCE'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Attendance & Photos</span>
        </button>

        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'REPORTS'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Reports (Late/Absent/OT)</span>
        </button>

        <button
          onClick={() => setActiveTab('ADVANCE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ADVANCE'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4 text-amber-300" />
          <span>Advance Salary</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYROLL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'PAYROLL'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Monthly Salary & Slips (30d)</span>
        </button>

        <button
          onClick={() => setActiveTab('RULES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'RULES'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Working Times & Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'AUDIT'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          
          {/* Top Quick Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Total Plant Workers
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-black text-white">{workers.length}</span>
                <Users className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {workers.filter(w => w.status === 'ACTIVE').length} Active • {workers.filter(w => w.status !== 'ACTIVE').length} On Leave
              </p>
            </div>

            <div className="bg-slate-900 border border-emerald-800/60 p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950/30">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                Inside Factory Floor
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-black text-emerald-400">{insideCount}</span>
                <UserCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {checkedInCount} checked in today • {lateCount} arrived late
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider block">
                Gate Security Guards
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-black text-sky-400">
                  {guards.filter(g => g.status === 'ACTIVE').length}
                </span>
                <ShieldCheck className="w-5 h-5 text-sky-400" />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Active at Gate 1 & Gate 2
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
                Monthly Wage Liability (30d)
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {formatCurrency(totalPayrollEst)}
                </span>
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                30-day monthly salary default basis
              </p>
            </div>

          </div>

          {/* Quick Action Cards & Live Gate Link */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Guard Terminal Launcher */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-emerald-500/40 p-6 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/40">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Factory Gate Attendance Terminal</h3>
                  <p className="text-xs text-slate-400">
                    Switch to the guard-operated gate terminal to mark check-in with front/back camera and photo proof.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Strict Guard-Operated Gate Architecture
                </div>
                <p className="text-slate-400">
                  Workers never mark their own attendance. Security Guard captures live photo with embedded timestamp and verifies worker identity.
                </p>
              </div>

              <button
                onClick={onSwitchToGuardTerminal}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
              >
                <span>Launch Security Guard Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Management Shortcuts */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="font-bold text-base text-white">
                Factory Administrative Quick Access
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  onClick={() => setActiveTab('WORKERS')}
                  className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4 text-emerald-400 mb-1.5" />
                  <div className="font-bold text-white">Worker Directory</div>
                  <div className="text-[11px] text-slate-400">Profiles, photo upload, working times</div>
                </button>

                <button
                  onClick={() => setActiveTab('ATTENDANCE')}
                  className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-colors cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-sky-400 mb-1.5" />
                  <div className="font-bold text-white">Attendance & Photos</div>
                  <div className="text-[11px] text-slate-400">View live gate roll & photo proofs</div>
                </button>

                <button
                  onClick={() => setActiveTab('PAYROLL')}
                  className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-colors cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-amber-400 mb-1.5" />
                  <div className="font-bold text-white">Monthly Salary (30d)</div>
                  <div className="text-[11px] text-slate-400">Calculate net wages, print slips</div>
                </button>

                <button
                  onClick={() => setActiveTab('RULES')}
                  className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-colors cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-purple-400 mb-1.5" />
                  <div className="font-bold text-white">Working Time Rules</div>
                  <div className="text-[11px] text-slate-400">3 working times, 30-day salary basis</div>
                </button>
              </div>

              {/* Reset to demo seed data */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={async () => {
                    if (confirm('Reset factory database to initial seed data (both backend and local)?')) {
                      await ApiService.resetDatabase();
                      await handleRefresh();
                      window.location.reload();
                    }
                  }}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Reset Factory Demo Database to Seed Records
                </button>
              </div>
            </div>

          </div>

          {/* Today's Attendance Snapshot Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-slate-800/80 px-6 py-4 flex items-center justify-between border-b border-slate-700">
              <h3 className="font-bold text-white text-sm">
                Today's Live Gate Attendance Roll ({attendanceToday.length} Logged)
              </h3>
              <button
                onClick={() => setActiveTab('ATTENDANCE')}
                className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>View Attendance & Photos Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/70 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Worker</th>
                    <th className="py-2.5 px-4">Working Time</th>
                    <th className="py-2.5 px-4">Check-In</th>
                    <th className="py-2.5 px-4">Marked By Guard</th>
                    <th className="py-2.5 px-4">Check-Out</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {attendanceToday.slice(0, 5).map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-medium text-white flex items-center gap-2">
                        <img
                          src={r.workerPhoto}
                          alt={r.workerName}
                          className="w-7 h-7 rounded-full object-cover border border-slate-700"
                        />
                        <span>{r.workerName} ({r.workerEmployeeId})</span>
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-emerald-400">{r.workingTime}</td>
                      <td className="py-2.5 px-4 text-xs font-mono text-white">{r.checkInTime}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-400">
                        <span className="font-medium text-slate-200">{r.checkInMarkedByGuardName}</span> ({r.checkInGate})
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-slate-300">{r.checkOutTime || 'Inside Plant'}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          r.status === 'PRESENT'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : r.status === 'PRESENT - LATE'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : r.status === 'PRESENT + OT'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-blue-950 text-blue-400 border border-blue-800'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* WORKERS TAB */}
      {activeTab === 'WORKERS' && (
        <WorkerManagement onDataChanged={handleRefresh} />
      )}

      {/* GUARDS TAB */}
      {activeTab === 'GUARDS' && (
        <GuardManagement onDataChanged={handleRefresh} />
      )}

      {/* ATTENDANCE & PHOTOS TAB */}
      {activeTab === 'ATTENDANCE' && (
        <LiveAttendanceView
          workers={workers}
          adminName={session.name}
          onDataChanged={handleRefresh}
        />
      )}

      {/* REPORTS TAB (LATE, ABSENT, OT, MONTHLY) */}
      {activeTab === 'REPORTS' && (
        <ReportsView onRefresh={handleRefresh} />
      )}

      {/* ADVANCE SALARY MANAGEMENT MODULE */}
      {activeTab === 'ADVANCE' && (
        <AdvanceSalaryManagement
          session={session}
          workers={workers}
          onRefreshParent={handleRefresh}
        />
      )}

      {/* PAYROLL TAB (30-DAY BASIS) */}
      {activeTab === 'PAYROLL' && (
        <PayrollManagementView
          workers={workers}
          rules={rules}
          adminName={session.name}
        />
      )}

      {/* WORKING TIMES & RULES TAB */}
      {activeTab === 'RULES' && (
        <AttendanceRulesConfigView onDataChanged={handleRefresh} />
      )}

      {/* AUDIT TAB */}
      {activeTab === 'AUDIT' && <AuditLogsView />}

    </div>
  );
};
