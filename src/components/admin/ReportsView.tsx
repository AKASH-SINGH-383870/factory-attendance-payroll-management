import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Search,
  Download,
  Printer,
  Clock,
  UserX,
  TrendingUp,
  Filter,
  RefreshCw,
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { formatCurrency, formatDisplayDate } from '../../utils/timeCalculations';
import { ReportSummaryMetrics } from '../../types';

interface ReportsViewProps {
  onRefresh?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [activeSubTab, setActiveSubTab] = useState<'LATE' | 'ABSENT' | 'OT' | 'MONTHLY'>('LATE');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const [reportData, setReportData] = useState<{
    month: string;
    summary: ReportSummaryMetrics;
    lateRecords: any[];
    absentRecords: any[];
    otRecords: any[];
    workerMonthlyMatrix: any[];
  } | null>(null);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getReports(selectedMonth);
      setReportData(data);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [selectedMonth]);

  // Departments list for dropdown
  const departments = useMemo(() => {
    if (!reportData) return [];
    const depts = new Set<string>();
    reportData.workerMonthlyMatrix.forEach(w => {
      if (w.department) depts.add(w.department);
    });
    return Array.from(depts);
  }, [reportData]);

  // Filtered lists
  const filteredLate = useMemo(() => {
    if (!reportData?.lateRecords) return [];
    return reportData.lateRecords.filter(r => {
      const matchSearch =
        (r.workerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = departmentFilter === 'ALL' || r.department === departmentFilter;
      return matchSearch && matchDept;
    });
  }, [reportData, searchQuery, departmentFilter]);

  const filteredAbsent = useMemo(() => {
    if (!reportData?.absentRecords) return [];
    return reportData.absentRecords.filter(r => {
      const matchSearch =
        (r.workerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = departmentFilter === 'ALL' || r.department === departmentFilter;
      return matchSearch && matchDept;
    });
  }, [reportData, searchQuery, departmentFilter]);

  const filteredOt = useMemo(() => {
    if (!reportData?.otRecords) return [];
    return reportData.otRecords.filter(r => {
      const matchSearch =
        (r.workerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = departmentFilter === 'ALL' || r.department === departmentFilter;
      return matchSearch && matchDept;
    });
  }, [reportData, searchQuery, departmentFilter]);

  const filteredMonthly = useMemo(() => {
    if (!reportData?.workerMonthlyMatrix) return [];
    return reportData.workerMonthlyMatrix.filter(r => {
      const matchSearch =
        (r.workerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = departmentFilter === 'ALL' || r.department === departmentFilter;
      return matchSearch && matchDept;
    });
  }, [reportData, searchQuery, departmentFilter]);

  // CSV Export functions
  const handleExportCSV = () => {
    let filename = '';
    let csvRows: string[][] = [];

    if (activeSubTab === 'LATE') {
      filename = `factory_late_report_${selectedMonth}.csv`;
      csvRows.push(['Date', 'Emp ID', 'Worker Name', 'Department', 'Working Time', 'Check-In Time', 'Late Minutes', 'Late Deduction (INR)', 'Marked By Guard', 'Source']);
      filteredLate.forEach(r => {
        csvRows.push([
          r.date,
          r.employeeId,
          `"${r.workerName}"`,
          `"${r.department}"`,
          `"${r.workingTime}"`,
          r.checkInTime,
          r.lateMinutes ?? 0,
          Number(r.deductionAmount || 0).toFixed(2),
          `"${r.guardName || '-'}"`,
          r.recordSource || 'seed',
        ]);
      });
    } else if (activeSubTab === 'ABSENT') {
      filename = `factory_absenteeism_report_${selectedMonth}.csv`;
      csvRows.push(['Date', 'Emp ID', 'Worker Name', 'Department', 'Working Time', 'Daily Wage Deducted (INR)', 'Marked By Guard', 'Source']);
      filteredAbsent.forEach(r => {
        csvRows.push([
          r.date,
          r.employeeId,
          `"${r.workerName}"`,
          `"${r.department}"`,
          `"${r.workingTime}"`,
          Number(r.deductionAmount || 0).toFixed(2),
          `"${r.guardName || '-'}"`,
          r.recordSource || 'seed',
        ]);
      });
    } else if (activeSubTab === 'OT') {
      filename = `factory_overtime_report_${selectedMonth}.csv`;
      csvRows.push(['Date', 'Emp ID', 'Worker Name', 'Department', 'Working Time', 'End Time', 'Check-Out Time', 'OT Minutes', 'OT Pay (INR)', 'Marked By Guard', 'Source']);
      filteredOt.forEach(r => {
        csvRows.push([
          r.date,
          r.employeeId,
          `"${r.workerName}"`,
          `"${r.department}"`,
          `"${r.workingTime}"`,
          r.workingEndTime,
          r.checkOutTime,
          r.overtimeMinutes ?? 0,
          Number(r.otPayAmount || 0).toFixed(2),
          `"${r.guardName || '-'}"`,
          r.recordSource || 'seed',
        ]);
      });
    } else {
      filename = `factory_monthly_matrix_${selectedMonth}.csv`;
      csvRows.push(['Emp ID', 'Worker Name', 'Department', 'Working Time', 'Monthly Base Salary', 'Days Present', 'Days Absent', 'Late Minutes', 'Late Cut', 'OT Minutes', 'OT Pay', 'Advance Cut', 'Net Payable Salary']);
      filteredMonthly.forEach(r => {
        csvRows.push([
          r.employeeId,
          `"${r.workerName}"`,
          `"${r.department}"`,
          `"${r.workingTime}"`,
          r.baseSalary ?? 0,
          r.daysPresent ?? 30,
          r.daysAbsent ?? 0,
          r.totalLateMinutes ?? 0,
          Number(r.totalLateDeduction || 0).toFixed(2),
          r.totalOtMinutes ?? 0,
          Number(r.totalOtPay || 0).toFixed(2),
          Number(r.advanceDeduction || 0).toFixed(2),
          Number(r.netSalary || 0).toFixed(2),
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = reportData?.summary;

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Factory Attendance & Wage Reports</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit summaries calculated dynamically from backend attendance records (seeded demo + live gate logs).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-xs font-mono outline-none"
            />
          </div>

          <button
            onClick={loadReportData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
              Total Late Minutes
            </span>
            <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">
              {summary.totalLateMinutes} mins
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
              Cut: -{formatCurrency(summary.totalLateDeductions, true)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">
              Total Absent Days
            </span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
              {summary.totalAbsentDays} Days
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
              Cut: -{formatCurrency(summary.totalLateDeductions ? (summary.totalAbsentDays * 500) : 0, true)} (1d = Monthly÷30)
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider block">
              Total Overtime (OT)
            </span>
            <span className="text-2xl font-black text-sky-400 font-mono mt-1 block">
              {summary.totalOtMinutes} mins
            </span>
            <span className="text-[11px] text-emerald-400 block mt-0.5 font-mono">
              Pay Added: +{formatCurrency(summary.totalOtPaid, true)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
              Net Monthly Wage Liability
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
              {formatCurrency(summary.totalWageLiability, true)}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Strict 30-day salary formula
            </span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex flex-wrap gap-1">
          <button
            onClick={() => setActiveSubTab('LATE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'LATE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Late Report ({reportData?.lateRecords.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ABSENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'ABSENT'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Absent Report ({reportData?.absentRecords.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('OT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'OT'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>OT Report ({reportData?.otRecords.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('MONTHLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'MONTHLY'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Monthly Matrix ({reportData?.workerMonthlyMatrix.length || 0})</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search Worker / Emp ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d} className="bg-slate-900 text-white">
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Report Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {/* 1. LATE REPORT TABLE */}
          {activeSubTab === 'LATE' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/70 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Worker & ID</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Working Time</th>
                  <th className="py-3 px-4">Check-In Time</th>
                  <th className="py-3 px-4 text-amber-400">Late Minutes</th>
                  <th className="py-3 px-4 text-rose-400">Late Deduction (Per-Min)</th>
                  <th className="py-3 px-4">Marked By Guard</th>
                  <th className="py-3 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredLate.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                      No late attendance records found for {selectedMonth}.
                    </td>
                  </tr>
                ) : (
                  filteredLate.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs text-white">{r.date}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{r.workerName}</div>
                        <div className="text-[11px] font-mono text-sky-400">{r.employeeId}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">{r.department}</td>
                      <td className="py-3 px-4 font-mono text-xs text-emerald-400">{r.workingTime}</td>
                      <td className="py-3 px-4 font-mono text-xs text-white">{r.checkInTime}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">+{r.lateMinutes} mins</td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-400">-{formatCurrency(r.deductionAmount, true)}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        <span className="text-slate-200">{r.guardName || '-'}</span> ({r.gate || 'Main Gate'})
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          r.recordSource === 'live'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {r.recordSource || 'seed'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 2. ABSENT REPORT TABLE */}
          {activeSubTab === 'ABSENT' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/70 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Worker & ID</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Working Time</th>
                  <th className="py-3 px-4 text-rose-400">Daily Wage Cut (1 Day = Monthly÷30)</th>
                  <th className="py-3 px-4">Policy Rule</th>
                  <th className="py-3 px-4">Marked By</th>
                  <th className="py-3 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAbsent.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                      No absent records found for {selectedMonth}.
                    </td>
                  </tr>
                ) : (
                  filteredAbsent.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs text-white">{r.date}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{r.workerName}</div>
                        <div className="text-[11px] font-mono text-sky-400">{r.employeeId}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">{r.department}</td>
                      <td className="py-3 px-4 font-mono text-xs text-emerald-400">{r.workingTime}</td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-400">-{formatCurrency(r.deductionAmount, true)}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">Single Day Deduction (No Double Cut)</td>
                      <td className="py-3 px-4 text-xs text-slate-300">{r.guardName || 'Security Gate'}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          r.recordSource === 'live'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {r.recordSource || 'seed'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 3. OVERTIME (OT) REPORT TABLE */}
          {activeSubTab === 'OT' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/70 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Worker & ID</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Working End Time</th>
                  <th className="py-3 px-4">Actual Check-Out</th>
                  <th className="py-3 px-4 text-sky-400">Overtime Minutes</th>
                  <th className="py-3 px-4 text-emerald-400">OT Pay Added</th>
                  <th className="py-3 px-4">Guard at Gate</th>
                  <th className="py-3 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredOt.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                      No overtime records found for {selectedMonth}.
                    </td>
                  </tr>
                ) : (
                  filteredOt.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs text-white">{r.date}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{r.workerName}</div>
                        <div className="text-[11px] font-mono text-sky-400">{r.employeeId}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">{r.department}</td>
                      <td className="py-3 px-4 font-mono text-xs text-amber-300">{r.workingEndTime}</td>
                      <td className="py-3 px-4 font-mono text-xs text-white">{r.checkOutTime}</td>
                      <td className="py-3 px-4 font-mono font-bold text-sky-400">+{r.overtimeMinutes} mins OT</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">+{formatCurrency(r.otPayAmount, true)}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        <span className="text-slate-200">{r.guardName || '-'}</span> ({r.gate || 'Exit Gate'})
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          r.recordSource === 'live'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {r.recordSource || 'seed'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 4. MONTHLY ATTENDANCE MATRIX */}
          {activeSubTab === 'MONTHLY' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/70 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Worker & Working Time</th>
                  <th className="py-3 px-4">Monthly Salary (30d)</th>
                  <th className="py-3 px-4">Days Present / 30</th>
                  <th className="py-3 px-4 text-rose-400">Absent Deduction</th>
                  <th className="py-3 px-4 text-amber-400">Late Deduction</th>
                  <th className="py-3 px-4 text-sky-400">OT Pay Added</th>
                  <th className="py-3 px-4 text-amber-400">Advance Cut</th>
                  <th className="py-3 px-4 text-emerald-400 font-bold">Net Salary</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredMonthly.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                      No monthly records found for {selectedMonth}.
                    </td>
                  </tr>
                ) : (
                  filteredMonthly.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{r.workerName}</div>
                        <div className="text-[11px] font-mono text-slate-400">{r.employeeId} • {r.department}</div>
                        <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">{r.workingTime}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                        <div>{formatCurrency(r.baseSalary)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          ₹{Number(r.dailyWage != null ? r.dailyWage : ((r.baseSalary || 15000) / 30)).toFixed(0)}/day
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        <span className="text-emerald-400 font-bold">{r.daysPresent}</span> / 30 Days
                        {r.daysAbsent > 0 && <span className="block text-[11px] text-rose-400 font-medium">({r.daysAbsent} Absent)</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {r.absentDeduction > 0 ? (
                          <span className="text-rose-400 font-bold">-{formatCurrency(r.absentDeduction, true)}</span>
                        ) : (
                          <span className="text-slate-500">₹0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {r.totalLateDeduction > 0 ? (
                          <div>
                            <span className="text-amber-400 font-bold">-{formatCurrency(r.totalLateDeduction, true)}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">({r.totalLateMinutes}m late)</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">₹0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {r.totalOtPay > 0 ? (
                          <div>
                            <span className="text-sky-400 font-bold">+{formatCurrency(r.totalOtPay, true)}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">({r.totalOtMinutes}m OT)</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">₹0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {r.advanceDeduction > 0 ? (
                          <div>
                            <span className="text-amber-400 font-bold">-{formatCurrency(r.advanceDeduction, true)}</span>
                            {r.advanceCarriedForward > 0 && (
                              <span className="block text-[10px] text-amber-300 font-normal">(CF: ₹{r.advanceCarriedForward})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">₹0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-base text-emerald-400">
                        {formatCurrency(r.netSalary, true)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit ${
                          r.paymentStatus === 'PAID'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950/60 text-amber-300 border border-amber-800'
                        }`}>
                          {r.paymentStatus === 'PAID' ? <CheckCircle2 className="w-3 h-3" /> : null}
                          {r.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
};
