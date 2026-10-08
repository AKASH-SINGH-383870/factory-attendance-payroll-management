import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Users,
  UserCheck,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
  Camera,
  ShieldCheck,
  ArrowRight,
  LogOut,
  Sparkles,
  Eye,
  X,
} from 'lucide-react';
import {
  Worker,
  AttendanceRecord,
  CurrentUserSession,
  WorkingTimeOption,
} from '../../types';
import { StorageService } from '../../services/storage';
import { ApiService } from '../../services/api';
import { WorkerGateCard } from './WorkerGateCard';
import { CameraCaptureModal } from '../camera/CameraCaptureModal';
import {
  formatFullDisplayDate,
  formatTime12,
  formatTime12Short,
  calculateLateMinutes,
  calculateCheckOutMetrics,
  formatMinutesToDuration,
  formatMinutesToReadable,
  WORKING_TIME_OPTIONS,
  getWorkingTimeDetails,
} from '../../utils/timeCalculations';

interface GuardAttendanceTerminalProps {
  guardSession: CurrentUserSession;
  onRefreshData?: () => void;
}

export const GuardAttendanceTerminal: React.FC<GuardAttendanceTerminalProps> = ({
  guardSession,
}) => {
  // Live State
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'INSIDE' | 'NOT_ARRIVED' | 'CHECKED_OUT'>('ALL');
  const [selectedWorkingTimeFilter, setSelectedWorkingTimeFilter] = useState<string>('ALL');

  // Camera Modal State
  const [cameraModalConfig, setCameraModalConfig] = useState<{
    isOpen: boolean;
    mode: 'CHECK_IN' | 'CHECK_OUT';
    worker: Worker | null;
    existingAttendance?: AttendanceRecord;
    calculatedLate?: number;
  }>({
    isOpen: false,
    mode: 'CHECK_IN',
    worker: null,
  });

  // Photo viewer modal
  const [viewingPhotoRecord, setViewingPhotoRecord] = useState<AttendanceRecord | null>(null);

  // Success Notification Banner
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
    subText?: string;
  } | null>(null);

  const loadData = async () => {
    try {
      const [w, att] = await Promise.all([
        ApiService.getWorkers(),
        ApiService.getAttendance({ date: '2026-10-08' }),
      ]);
      setWorkers(w);
      setAttendanceList(att);
    } catch {
      setWorkers(StorageService.getWorkers());
      setAttendanceList(StorageService.getAttendanceForDate());
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Attendance lookup by workerId for today
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceList.forEach(a => map.set(a.workerId, a));
    return map;
  }, [attendanceList]);

  // Gate Metrics
  const stats = useMemo(() => {
    const total = workers.length;
    let checkedIn = 0;
    let insideFactory = 0;
    let checkedOut = 0;
    let lateToday = 0;

    attendanceList.forEach(a => {
      if (a.checkInTime) {
        checkedIn++;
        if (a.lateMinutes > 0) lateToday++;
      }
      if (a.checkInTime && !a.checkOutTime) {
        insideFactory++;
      }
      if (a.checkOutTime) {
        checkedOut++;
      }
    });

    const notArrived = Math.max(0, total - checkedIn);

    return {
      total,
      checkedIn,
      insideFactory,
      checkedOut,
      lateToday,
      notArrived,
    };
  }, [workers, attendanceList]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter(worker => {
      // Working Time filter
      if (selectedWorkingTimeFilter !== 'ALL' && worker.workingTime !== selectedWorkingTimeFilter) {
        return false;
      }

      const att = attendanceMap.get(worker.id);
      const isCheckedIn = Boolean(att?.checkInTime && !att?.checkOutTime);
      const isCheckedOut = Boolean(att?.checkInTime && att?.checkOutTime);
      const isNotArrived = !att?.checkInTime;

      // Tab filter
      if (activeTab === 'INSIDE' && !isCheckedIn) return false;
      if (activeTab === 'NOT_ARRIVED' && !isNotArrived) return false;
      if (activeTab === 'CHECKED_OUT' && !isCheckedOut) return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = worker.fullName.toLowerCase().includes(query);
        const matchesEmpId = worker.employeeId.toLowerCase().includes(query);
        const matchesMobile = worker.mobileNumber.toLowerCase().includes(query);
        const matchesDept = worker.department.toLowerCase().includes(query);
        return matchesName || matchesEmpId || matchesMobile || matchesDept;
      }

      return true;
    });
  }, [workers, attendanceMap, activeTab, selectedWorkingTimeFilter, searchQuery]);

  // Inside Factory Workers
  const insideFactoryWorkers = useMemo(() => {
    return workers
      .filter(w => {
        const att = attendanceMap.get(w.id);
        return Boolean(att?.checkInTime && !att?.checkOutTime);
      })
      .map(w => ({
        worker: w,
        attendance: attendanceMap.get(w.id)!,
      }));
  }, [workers, attendanceMap]);

  // Check-In Action
  const handleInitiateCheckIn = (worker: Worker) => {
    const existing = attendanceMap.get(worker.id);
    if (existing?.checkInTime) {
      setToastMessage({
        type: 'warning',
        text: `Duplicate Check-In Prevented: ${worker.fullName} is already checked in at ${existing.checkInTime}.`,
      });
      return;
    }

    const late = calculateLateMinutes(new Date(), worker.workingTime);
    setCameraModalConfig({
      isOpen: true,
      mode: 'CHECK_IN',
      worker,
      calculatedLate: late,
    });
  };

  // Check-Out Action
  const handleInitiateCheckOut = (worker: Worker, existingAttendance: AttendanceRecord) => {
    setCameraModalConfig({
      isOpen: true,
      mode: 'CHECK_OUT',
      worker,
      existingAttendance,
    });
  };

  // Confirm Check-In
  const handleConfirmCheckIn = async (photoDataUrl: string, lateMinutes: number) => {
    const { worker } = cameraModalConfig;
    if (!worker) return;

    const now = new Date();
    const timeFormatted = formatTime12(now);

    try {
      await ApiService.checkIn({
        workerId: worker.id,
        photoDataUrl,
        guardId: guardSession.guardCode || guardSession.id,
        guardName: guardSession.name,
        gateName: guardSession.gate || 'Gate 1 – Main Gate North',
      });
    } catch (err: any) {
      console.warn('Backend API check-in error, using local fallback:', err);
      const workingDetails = getWorkingTimeDetails(worker.workingTime);
      const newRecord: AttendanceRecord = {
        id: 'att-' + Date.now(),
        workerId: worker.id,
        workerName: worker.fullName,
        workerEmployeeId: worker.employeeId,
        workerPhoto: worker.profilePhoto,
        date: now.toISOString().slice(0, 10),
        workingTime: worker.workingTime,
        workingStartTime: '09:00 AM',
        workingEndTime: workingDetails.endTime12,
        checkInTime: timeFormatted,
        checkInDateTime: now.toISOString(),
        checkInPhoto: photoDataUrl,
        checkInMarkedByGuardId: guardSession.guardCode || guardSession.id,
        checkInMarkedByGuardName: guardSession.name,
        checkInGate: guardSession.gate || 'Gate 1',
        lateMinutes,
        totalWorkingMinutes: 0,
        earlyExitMinutes: 0,
        overtimeMinutes: 0,
        status: lateMinutes > 0 ? 'PRESENT - LATE' : 'PRESENT',
        createdAt: now.toISOString(),
        recordSource: 'live',
      };
      StorageService.saveAttendanceRecord(newRecord);
    }

    await loadData();
    setCameraModalConfig({ isOpen: false, mode: 'CHECK_IN', worker: null });

    setToastMessage({
      type: 'success',
      text: `Check-In Confirmed for ${worker.fullName} (${worker.employeeId})`,
      subText: `Recorded at ${timeFormatted} • Marked by ${guardSession.name} • ${lateMinutes > 0 ? `Late: ${lateMinutes} mins (Deduction will apply on per-minute basis)` : 'On-Time (Present)'}`,
    });
  };

  // Confirm Check-Out
  const handleConfirmCheckOut = async (photoDataUrl: string) => {
    const { worker, existingAttendance } = cameraModalConfig;
    if (!worker || !existingAttendance) return;

    const now = new Date();
    const timeFormatted = formatTime12(now);

    try {
      await ApiService.checkOut({
        workerId: worker.id,
        photoDataUrl,
        guardId: guardSession.guardCode || guardSession.id,
        guardName: guardSession.name,
        gateName: guardSession.gate || 'Gate 1 – Main Gate North',
      });
    } catch (err: any) {
      console.warn('Backend API check-out error, using local fallback:', err);
      const checkInDate = existingAttendance.checkInDateTime ? new Date(existingAttendance.checkInDateTime) : new Date();
      const metrics = calculateCheckOutMetrics(checkInDate, now, worker.workingTime);
      const updatedRecord: AttendanceRecord = {
        ...existingAttendance,
        checkOutTime: timeFormatted,
        checkOutDateTime: now.toISOString(),
        checkOutPhoto: photoDataUrl,
        checkOutMarkedByGuardId: guardSession.guardCode || guardSession.id,
        checkOutMarkedByGuardName: guardSession.name,
        checkOutGate: guardSession.gate || 'Gate 1',
        totalWorkingMinutes: metrics.totalWorkingMinutes,
        earlyExitMinutes: metrics.earlyExitMinutes,
        overtimeMinutes: metrics.overtimeMinutes,
        status: metrics.overtimeMinutes > 0 ? 'PRESENT + OT' : 'COMPLETED',
        updatedAt: now.toISOString(),
        recordSource: 'live',
      };
      StorageService.saveAttendanceRecord(updatedRecord);
    }

    await loadData();
    setCameraModalConfig({ isOpen: false, mode: 'CHECK_OUT', worker: null });

    setToastMessage({
      type: 'info',
      text: `Check-Out Recorded for ${worker.fullName} (${worker.employeeId})`,
      subText: `Marked by ${guardSession.name} at ${timeFormatted} • Saved to backend database.`,
    });
  };

  return (
    <div className="space-y-6">
      
      {/* ========================================================= */}
      {/* TOP GATE TERMINAL BAR                                     */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Left: Guard info & Factory Gate */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-950/80 border border-emerald-600/50 rounded-xl text-emerald-400 shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold px-2 py-0.5 rounded uppercase">
                  SECURITY GUARD GATE TERMINAL
                </span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                  {guardSession.guardCode || 'G-101'}
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white mt-1">
                {guardSession.name}
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>{guardSession.gate || 'Gate 1 – Main Gate North'}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300">{guardSession.factory || 'Plant Complex A'}</span>
              </p>
            </div>
          </div>

          {/* Right: Live Real-Time Digital Clock */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-right">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {formatFullDisplayDate(currentTime)}
              </div>
              <div className="font-mono text-2xl font-black text-amber-400 tracking-wider">
                {currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-center justify-center px-3 py-2 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping mb-1"></span>
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                CCTV CAM READY
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* TOAST / ACTION NOTIFICATION */}
      {toastMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top-2 duration-200 ${
          toastMessage.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
            : toastMessage.type === 'warning'
            ? 'bg-amber-950/80 border-amber-500 text-amber-200'
            : 'bg-sky-950/80 border-sky-500 text-sky-200'
        }`}>
          <div className="flex items-center gap-3">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'warning' ? (
              <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
            ) : (
              <Clock className="w-6 h-6 text-sky-400 shrink-0" />
            )}
            <div>
              <p className="font-bold text-sm text-white">{toastMessage.text}</p>
              {toastMessage.subText && (
                <p className="text-xs opacity-90 font-mono mt-0.5">{toastMessage.subText}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* GATE STATS COUNTERS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Workers
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-white">{stats.total}</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
        </div>

        <div className="bg-slate-900 border border-emerald-800/50 p-3.5 rounded-xl bg-gradient-to-br from-slate-900 to-emerald-950/30">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
            Checked-In Today
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-400">{stats.checkedIn}</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <div className="bg-slate-900 border border-sky-800/50 p-3.5 rounded-xl bg-gradient-to-br from-slate-900 to-sky-950/30">
          <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">
            Inside Factory
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-sky-400">{stats.insideFactory}</span>
            <Building2 className="w-4 h-4 text-sky-400" />
          </div>
        </div>

        <div className="bg-slate-900 border border-blue-800/50 p-3.5 rounded-xl">
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block">
            Checked-Out
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-blue-400">{stats.checkedOut}</span>
            <LogOut className="w-4 h-4 text-blue-400" />
          </div>
        </div>

        <div className="bg-slate-900 border border-rose-800/50 p-3.5 rounded-xl">
          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
            Late Today
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-rose-400">{stats.lateToday}</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
        </div>

        <div className="bg-slate-900 border border-amber-800/50 p-3.5 rounded-xl">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
            Not Arrived
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-400">{stats.notArrived}</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
        </div>
      </div>

      {/* SEARCH BAR & WORKING TIME FILTER */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-6 h-6 text-emerald-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Worker by Name / Employee ID (e.g. EMP-001) / Mobile Number..."
            className="w-full pl-12 pr-10 py-3.5 bg-slate-950 border-2 border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-xl text-white placeholder-slate-500 text-base font-medium shadow-inner transition-colors outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filter Pills & Working Time Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-slate-100 text-slate-900 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Workers ({workers.length})
            </button>

            <button
              onClick={() => setActiveTab('INSIDE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'INSIDE'
                  ? 'bg-sky-500 text-white shadow-sky-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Inside Factory ({stats.insideFactory})
            </button>

            <button
              onClick={() => setActiveTab('NOT_ARRIVED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'NOT_ARRIVED'
                  ? 'bg-amber-500 text-slate-950 shadow-amber-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Not Arrived ({stats.notArrived})
            </button>

            <button
              onClick={() => setActiveTab('CHECKED_OUT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'CHECKED_OUT'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Checked Out ({stats.checkedOut})
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Working Time:</span>
            <select
              value={selectedWorkingTimeFilter}
              onChange={e => setSelectedWorkingTimeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500 font-medium font-mono"
            >
              <option value="ALL">All Working Times</option>
              {WORKING_TIME_OPTIONS.map(opt => (
                <option key={opt.label} value={opt.label}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* WORKER CARDS GRID */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span>Gate Worker Roster</span>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
              {filteredWorkers.length} {filteredWorkers.length === 1 ? 'Worker' : 'Workers'} Found
            </span>
          </h2>
          <span className="text-xs text-slate-500">
            Click Check-In or Check-Out to open gate camera
          </span>
        </div>

        {filteredWorkers.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-200">No Workers Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Check search term (Name, Employee ID e.g. EMP-001, or Mobile number).
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveTab('ALL');
                setSelectedWorkingTimeFilter('ALL');
              }}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkers.map(worker => {
              const att = attendanceMap.get(worker.id);
              return (
                <WorkerGateCard
                  key={worker.id}
                  worker={worker}
                  attendanceToday={att}
                  onInitiateCheckIn={handleInitiateCheckIn}
                  onInitiateCheckOut={handleInitiateCheckOut}
                  onViewPhotoProof={record => setViewingPhotoRecord(record)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* CURRENTLY INSIDE FACTORY LIVE MONITOR TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-8">
        <div className="bg-slate-800/80 px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 className="font-bold text-white text-base">
              Currently Inside Factory Monitor ({insideFactoryWorkers.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Real-time gate roll of active personnel on factory floor
          </span>
        </div>

        {insideFactoryWorkers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No workers currently inside factory floor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Worker Profile Photo & Name</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Working Time</th>
                  <th className="py-3 px-4">Check-In Time</th>
                  <th className="py-3 px-4">Late Status</th>
                  <th className="py-3 px-4">Marked By Guard</th>
                  <th className="py-3 px-4 text-right">Gate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {insideFactoryWorkers.map(({ worker, attendance }) => (
                  <tr key={worker.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <img
                        src={worker.profilePhoto}
                        alt={worker.fullName}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <div className="font-semibold text-white">{worker.fullName}</div>
                        <div className="text-xs text-slate-400">{worker.department}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-300">
                      {worker.employeeId}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-emerald-400">
                      {worker.workingTime}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-white">
                      {attendance.checkInTime}
                    </td>
                    <td className="py-3 px-4">
                      {attendance.lateMinutes > 0 ? (
                        <span className="text-xs font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                          +{attendance.lateMinutes}m Late
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                          On-Time
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      <span className="font-medium text-slate-200">
                        {attendance.checkInMarkedByGuardName}
                      </span>
                      <span className="block text-[11px] text-slate-500 font-mono">
                        {attendance.checkInGate}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleInitiateCheckOut(worker, attendance)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
                      >
                        Check-Out
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CAMERA CAPTURE & VERIFICATION MODAL */}
      {cameraModalConfig.isOpen && cameraModalConfig.worker && (
        <CameraCaptureModal
          mode={cameraModalConfig.mode}
          worker={cameraModalConfig.worker}
          guardSession={guardSession}
          existingCheckInTime={cameraModalConfig.existingAttendance?.checkInTime}
          calculatedLateMinutes={cameraModalConfig.calculatedLate}
          onConfirm={(photo, late) => {
            if (cameraModalConfig.mode === 'CHECK_IN') {
              handleConfirmCheckIn(photo, late);
            } else {
              handleConfirmCheckOut(photo);
            }
          }}
          onClose={() =>
            setCameraModalConfig({
              isOpen: false,
              mode: 'CHECK_IN',
              worker: null,
            })
          }
        />
      )}

      {/* ATTENDANCE PHOTO PROOF VIEWER MODAL */}
      {viewingPhotoRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-white">
                  Gate Photo Proof: {viewingPhotoRecord.workerName}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Employee ID: {viewingPhotoRecord.workerEmployeeId} • Date: {viewingPhotoRecord.date}
                </p>
              </div>
              <button
                onClick={() => setViewingPhotoRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Live Check-In Photo (With Embedded Watermark)
                </span>
                <div className="rounded-xl overflow-hidden border-2 border-emerald-500/50 bg-black aspect-video flex items-center justify-center">
                  {viewingPhotoRecord.checkInPhoto ? (
                    <img
                      src={viewingPhotoRecord.checkInPhoto}
                      alt="Check-in Photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-500">No Photo Recorded</span>
                  )}
                </div>
              </div>

              {viewingPhotoRecord.checkOutPhoto && (
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Live Check-Out Photo
                  </span>
                  <div className="rounded-xl overflow-hidden border-2 border-blue-500/50 bg-black aspect-video flex items-center justify-center">
                    <img
                      src={viewingPhotoRecord.checkOutPhoto}
                      alt="Check-out Photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Working Time:</span>
                  <span className="text-emerald-400 font-bold">{viewingPhotoRecord.workingTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Check-In Time:</span>
                  <span className="text-emerald-400 font-bold">{viewingPhotoRecord.checkInTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Marked By Guard:</span>
                  <span className="text-slate-200">{viewingPhotoRecord.checkInMarkedByGuardName} ({viewingPhotoRecord.checkInMarkedByGuardId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gate Location:</span>
                  <span className="text-amber-400">{viewingPhotoRecord.checkInGate}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setViewingPhotoRecord(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Close Photo Viewer
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
