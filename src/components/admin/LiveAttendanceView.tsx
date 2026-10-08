import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Eye,
  Edit2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  History,
  X,
  FileSpreadsheet,
  Download,
  Building,
  User,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { AttendanceRecord, Worker } from '../../types';
import { StorageService } from '../../services/storage';
import { ApiService } from '../../services/api';
import {
  formatMinutesToDuration,
  formatMinutesToReadable,
  WORKING_TIME_OPTIONS,
} from '../../utils/timeCalculations';
import { getTodayDateString } from '../../data/mockData';

interface LiveAttendanceViewProps {
  workers: Worker[];
  adminName: string;
  onDataChanged: () => void;
}

export const LiveAttendanceView: React.FC<LiveAttendanceViewProps> = ({
  workers,
  adminName,
  onDataChanged,
}) => {
  // Filters: Date, Date Range, Worker / Employee ID search, Status
  const [useDateRange, setUseDateRange] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [startDate, setStartDate] = useState<string>(getTodayDateString());
  const [endDate, setEndDate] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkingTime, setSelectedWorkingTime] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    'ALL' | 'PRESENT' | 'LATE' | 'OT' | 'ABSENT' | 'COMPLETED'
  >('ALL');

  // Photo Inspection Modal
  const [inspectRecord, setInspectRecord] = useState<AttendanceRecord | null>(null);

  // Manual Edit Modal (with mandatory reason for Audit Trail)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState<{
    checkInTime: string;
    checkOutTime: string;
    status: AttendanceRecord['status'];
    lateMinutes: number;
    overtimeMinutes: number;
    reason: string;
  }>({
    checkInTime: '',
    checkOutTime: '',
    status: 'PRESENT',
    lateMinutes: 0,
    overtimeMinutes: 0,
    reason: '',
  });

  // Direct, live retrieval from database
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);

  const loadAttendance = async () => {
    try {
      const data = await ApiService.getAttendance();
      setAttendanceList(data);
    } catch {
      setAttendanceList(StorageService.getAttendance());
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  // Filtered attendance records
  const filteredRecords = useMemo(() => {
    return attendanceList.filter(record => {
      // Date filtering
      if (useDateRange) {
        if (startDate && record.date < startDate) return false;
        if (endDate && record.date > endDate) return false;
      } else {
        if (selectedDate && record.date !== selectedDate) return false;
      }

      // Working Time filter
      if (selectedWorkingTime !== 'ALL' && record.workingTime !== selectedWorkingTime) {
        return false;
      }

      // Status filters: PRESENT, LATE, OT, ABSENT, COMPLETED
      if (selectedStatusFilter === 'PRESENT') {
        if (record.status !== 'PRESENT') return false;
      } else if (selectedStatusFilter === 'LATE') {
        if (record.lateMinutes <= 0 && record.status !== 'PRESENT - LATE') return false;
      } else if (selectedStatusFilter === 'OT') {
        if (record.overtimeMinutes <= 0 && record.status !== 'PRESENT + OT') return false;
      } else if (selectedStatusFilter === 'ABSENT') {
        if (record.status !== 'ABSENT') return false;
      } else if (selectedStatusFilter === 'COMPLETED') {
        if (record.status !== 'COMPLETED') return false;
      }

      // Search by Worker Name, Employee ID, or Guard Name
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          record.workerName.toLowerCase().includes(q) ||
          record.workerEmployeeId.toLowerCase().includes(q) ||
          record.checkInMarkedByGuardName.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [
    attendanceList,
    useDateRange,
    selectedDate,
    startDate,
    endDate,
    selectedWorkingTime,
    selectedStatusFilter,
    searchQuery,
  ]);

  const handleOpenEdit = (record: AttendanceRecord) => {
    setEditRecord(record);
    setEditForm({
      checkInTime: record.checkInTime || '',
      checkOutTime: record.checkOutTime || '',
      status: record.status,
      lateMinutes: record.lateMinutes || 0,
      overtimeMinutes: record.overtimeMinutes || 0,
      reason: '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord || !editForm.reason.trim()) return;

    try {
      await ApiService.adminOverrideAttendance(
        editRecord.id,
        {
          checkInTime: editForm.checkInTime,
          checkOutTime: editForm.checkOutTime,
          status: editForm.status,
          lateMinutes: Number(editForm.lateMinutes),
          overtimeMinutes: Number(editForm.overtimeMinutes),
        },
        adminName,
        editForm.reason.trim()
      );
    } catch {
      StorageService.adminOverrideAttendance(
        editRecord.id,
        {
          checkInTime: editForm.checkInTime,
          checkOutTime: editForm.checkOutTime,
          status: editForm.status,
          lateMinutes: Number(editForm.lateMinutes),
          overtimeMinutes: Number(editForm.overtimeMinutes),
        },
        adminName,
        editForm.reason.trim()
      );
    }

    setEditRecord(null);
    await loadAttendance();
    onDataChanged();
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Worker Name',
      'Employee ID',
      'Assigned Working Time',
      'Check-In Time',
      'Check-In Guard',
      'Gate',
      'Late Mins',
      'Check-Out Time',
      'Check-Out Guard',
      'Total Working Mins',
      'OT Mins',
      'Attendance Status',
    ];

    const rows = filteredRecords.map(r => [
      r.date,
      `"${r.workerName}"`,
      r.workerEmployeeId,
      `"${r.workingTime}"`,
      r.checkInTime || '',
      `"${r.checkInMarkedByGuardName}"`,
      `"${r.checkInGate}"`,
      r.lateMinutes,
      r.checkOutTime || '',
      `"${r.checkOutMarkedByGuardName || ''}"`,
      r.totalWorkingMinutes,
      r.overtimeMinutes,
      r.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `factory_attendance_photos_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Attendance & Photos Module</h2>
              <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono">
                {filteredRecords.length} Records Loaded
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time gate roll of all worker check-ins with stamped live CCTV photos and guard accountability.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseDateRange(!useDateRange)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                useDateRange
                  ? 'bg-sky-950 text-sky-300 border-sky-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              {useDateRange ? 'Single Date View' : 'Date Range Filter'}
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          
          {/* Date / Date Range Picker */}
          {useDateRange ? (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Attendance Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          )}

          {/* Working Time Filter */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Assigned Working Time
            </label>
            <select
              value={selectedWorkingTime}
              onChange={e => setSelectedWorkingTime(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500 font-mono"
            >
              <option value="ALL">All Working Times</option>
              {WORKING_TIME_OPTIONS.map(opt => (
                <option key={opt.label} value={opt.label}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Status Filter: Present, Absent, Late, OT */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Attendance Status
            </label>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Attendance Statuses</option>
              <option value="PRESENT">Present (On-Time)</option>
              <option value="LATE">Late Arrival</option>
              <option value="OT">Overtime (OT)</option>
              <option value="COMPLETED">Completed (Checked Out)</option>
              <option value="ABSENT">Absent Worker</option>
            </select>
          </div>

          {/* Search by Worker Name or EMP ID */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Search Worker / Employee ID
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rahul, EMP-001, Guard..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Records Table with Live Photos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Worker Profile Photo & Name</th>
                <th className="py-3 px-4">Emp ID</th>
                <th className="py-3 px-4">Working Time</th>
                <th className="py-3 px-4">Check-In Photo & Time</th>
                <th className="py-3 px-4">Check-Out Photo & Time</th>
                <th className="py-3 px-4">Total Time & OT</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Marked By Guard</th>
                <th className="py-3 px-4 text-right">Details & Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    No attendance records match the selected filters. Check-in records marked by Security Guards appear here automatically.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => (
                  <tr key={record.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* Worker Profile Photo & Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={record.workerPhoto}
                          alt={record.workerName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-white leading-tight">
                            {record.workerName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {record.date}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Employee ID */}
                    <td className="py-3 px-4 font-mono font-bold text-sky-400">
                      {record.workerEmployeeId}
                    </td>

                    {/* Assigned Working Time */}
                    <td className="py-3 px-4 font-mono text-xs text-emerald-400 font-semibold">
                      {record.workingTime}
                    </td>

                    {/* Check-In Details & Live Photo Thumbnail */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {record.checkInPhoto && (
                          <button
                            onClick={() => setInspectRecord(record)}
                            className="relative group w-12 h-12 rounded-lg overflow-hidden border border-emerald-600/50 bg-black shrink-0 cursor-pointer"
                            title="Click to zoom Live Check-In Photo with Timestamp"
                          >
                            <img
                              src={record.checkInPhoto}
                              alt="Check-in Photo"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-emerald-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </button>
                        )}
                        <div>
                          <div className="font-mono font-bold text-white text-xs">
                            {record.checkInTime || '--:--'}
                          </div>
                          {record.lateMinutes > 0 ? (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-1 rounded border border-rose-800 block w-fit">
                              +{record.lateMinutes}m Late
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400 block">
                              On-Time
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Check-Out Details & Photo */}
                    <td className="py-3 px-4">
                      {record.checkOutTime ? (
                        <div className="flex items-center gap-2">
                          {record.checkOutPhoto && (
                            <button
                              onClick={() => setInspectRecord(record)}
                              className="relative group w-12 h-12 rounded-lg overflow-hidden border border-blue-600/50 bg-black shrink-0 cursor-pointer"
                              title="Click to zoom Live Check-Out Photo"
                            >
                              <img
                                src={record.checkOutPhoto}
                                alt="Check-out Photo"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                            </button>
                          )}
                          <div>
                            <div className="font-mono font-bold text-white text-xs">
                              {record.checkOutTime}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Out
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-400 font-medium">
                          Inside Plant
                        </span>
                      )}
                    </td>

                    {/* Total Duration & OT Minutes */}
                    <td className="py-3 px-4 text-xs font-mono">
                      <div>
                        {record.totalWorkingMinutes > 0
                          ? formatMinutesToDuration(record.totalWorkingMinutes)
                          : '--'}
                      </div>
                      {record.overtimeMinutes > 0 && (
                        <div className="text-amber-300 font-bold">
                          +{record.overtimeMinutes}m OT
                        </div>
                      )}
                      {record.earlyExitMinutes > 0 && (
                        <div className="text-rose-400">
                          -{record.earlyExitMinutes}m Early
                        </div>
                      )}
                    </td>

                    {/* Attendance Status */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                          record.status === 'PRESENT'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : record.status === 'PRESENT - LATE'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : record.status === 'PRESENT + OT'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : record.status === 'COMPLETED'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {record.status}
                        </span>

                        {record.isManuallyModified && (
                          <span className="text-[10px] text-amber-300 font-mono bg-amber-950/60 px-1 rounded border border-amber-800">
                            Admin Overridden
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Marked By Guard */}
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-slate-200">
                        {record.checkInMarkedByGuardName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {record.checkInGate}
                      </div>
                    </td>

                    {/* Details Action */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectRecord(record)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Open Photo & Full Attendance Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => handleOpenEdit(record)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs transition-colors cursor-pointer"
                          title="Manual Admin Edit (Requires Audit Reason)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PHOTO INSPECTION & FULL ATTENDANCE DETAILS MODAL          */}
      {/* ========================================================= */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 text-white my-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-white">
                  Attendance Evidence & Photo Verification
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {inspectRecord.workerName} ({inspectRecord.workerEmployeeId}) • Date: {inspectRecord.date}
                </p>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Side-by-side: Check-In vs Check-Out Photo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1.5">
                  Check-In Live Photo Proof (Canvas Stamped)
                </span>
                <div className="rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-black aspect-video flex items-center justify-center">
                  {inspectRecord.checkInPhoto ? (
                    <img
                      src={inspectRecord.checkInPhoto}
                      alt="Check-in Photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-500">No Image Recorded</span>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-300 space-y-0.5">
                  <div>Check-In Time: <strong className="text-white font-mono">{inspectRecord.checkInTime}</strong></div>
                  <div>Marked By Guard: <strong className="text-white">{inspectRecord.checkInMarkedByGuardName}</strong> ({inspectRecord.checkInMarkedByGuardId})</div>
                  <div>Gate Location: <span className="text-amber-400">{inspectRecord.checkInGate}</span></div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1.5">
                  Check-Out Live Photo Proof
                </span>
                <div className="rounded-xl overflow-hidden border-2 border-blue-500/60 bg-black aspect-video flex items-center justify-center">
                  {inspectRecord.checkOutPhoto ? (
                    <img
                      src={inspectRecord.checkOutPhoto}
                      alt="Check-out Photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Clock className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                      <span className="text-xs text-slate-500">Still Inside Factory</span>
                    </div>
                  )}
                </div>
                {inspectRecord.checkOutTime && (
                  <div className="mt-2 text-xs text-slate-300 space-y-0.5">
                    <div>Check-Out Time: <strong className="text-white font-mono">{inspectRecord.checkOutTime}</strong></div>
                    <div>Marked By Guard: <strong className="text-white">{inspectRecord.checkOutMarkedByGuardName || 'Guard'}</strong></div>
                    <div>Gate Location: <span className="text-amber-400">{inspectRecord.checkOutGate || 'Gate 1'}</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Working Time:</span>
                <span className="text-emerald-400 font-bold">{inspectRecord.workingTime}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Late Minutes:</span>
                <span className={inspectRecord.lateMinutes > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                  {inspectRecord.lateMinutes} Mins
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Working:</span>
                <span className="text-white font-bold">
                  {formatMinutesToDuration(inspectRecord.totalWorkingMinutes)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Overtime (OT):</span>
                <span className={inspectRecord.overtimeMinutes > 0 ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                  {inspectRecord.overtimeMinutes} Mins
                </span>
              </div>
            </div>

            {/* Audit History If Any */}
            {inspectRecord.modificationHistory && inspectRecord.modificationHistory.length > 0 && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                <span className="font-semibold text-amber-400 flex items-center gap-1">
                  <History className="w-3.5 h-3.5" /> Modification Audit Trail:
                </span>
                {inspectRecord.modificationHistory.map((m, i) => (
                  <div key={i} className="text-slate-400 font-mono text-[11px]">
                    • Modified by <strong>{m.modifiedByAdminName}</strong> on {m.modifiedAt.slice(0, 16)}: {m.reason} ({m.oldValue} → {m.newValue})
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setInspectRecord(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADMIN MANUAL OVERRIDE MODAL WITH COMPULSORY REASON        */}
      {/* ========================================================= */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white">
                  Admin Manual Attendance Correction
                </h3>
                <p className="text-xs text-slate-400">
                  {editRecord.workerName} ({editRecord.workerEmployeeId}) • Date: {editRecord.date}
                </p>
              </div>
              <button
                onClick={() => setEditRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Check-In Time
                  </label>
                  <input
                    type="text"
                    value={editForm.checkInTime}
                    onChange={e => setEditForm({ ...editForm, checkInTime: e.target.value })}
                    placeholder="09:00:00 AM"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Check-Out Time
                  </label>
                  <input
                    type="text"
                    value={editForm.checkOutTime}
                    onChange={e => setEditForm({ ...editForm, checkOutTime: e.target.value })}
                    placeholder="07:00:00 PM"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="PRESENT - LATE">PRESENT - LATE</option>
                    <option value="PRESENT + OT">PRESENT + OT</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Late Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.lateMinutes}
                    onChange={e => setEditForm({ ...editForm, lateMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    OT Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.overtimeMinutes}
                    onChange={e => setEditForm({ ...editForm, overtimeMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* MANDATORY AUDIT REASON */}
              <div className="bg-amber-950/40 border border-amber-800/80 p-3 rounded-xl space-y-1">
                <label className="text-xs font-bold text-amber-300 block">
                  Mandatory Modification Reason (Preserved in Audit Log) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={editForm.reason}
                  onChange={e => setEditForm({ ...editForm, reason: e.target.value })}
                  placeholder="e.g. Worker was approved by supervisor for factory gate maintenance emergency."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="px-3 py-1.5 border border-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                >
                  Commit Audit Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
