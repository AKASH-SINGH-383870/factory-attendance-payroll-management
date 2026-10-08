import React from 'react';
import { LogIn, LogOut, CheckCircle2, Clock, ShieldCheck, AlertCircle, Eye } from 'lucide-react';
import { Worker, AttendanceRecord } from '../../types';
import { getWorkingTimeDetails } from '../../utils/timeCalculations';

interface WorkerGateCardProps {
  worker: Worker;
  attendanceToday?: AttendanceRecord;
  onInitiateCheckIn: (worker: Worker) => void;
  onInitiateCheckOut: (worker: Worker, attendance: AttendanceRecord) => void;
  onViewPhotoProof?: (record: AttendanceRecord) => void;
}

export const WorkerGateCard: React.FC<WorkerGateCardProps> = ({
  worker,
  attendanceToday,
  onInitiateCheckIn,
  onInitiateCheckOut,
  onViewPhotoProof,
}) => {
  const isCheckedIn = Boolean(attendanceToday?.checkInTime && !attendanceToday?.checkOutTime);
  const isCompleted = Boolean(attendanceToday?.checkInTime && attendanceToday?.checkOutTime);
  const isNotCheckedIn = !attendanceToday?.checkInTime;

  const workingDetails = getWorkingTimeDetails(worker.workingTime);

  return (
    <div className={`bg-slate-900 border rounded-xl overflow-hidden transition-all duration-150 hover:shadow-lg ${
      isCheckedIn 
        ? 'border-sky-500/50 shadow-sky-950/20' 
        : isCompleted 
        ? 'border-slate-800 opacity-90' 
        : 'border-slate-800 hover:border-slate-700'
    }`}>
      
      {/* Top Banner / Status Strip */}
      <div className={`px-4 py-1.5 flex items-center justify-between text-xs font-semibold ${
        isCheckedIn
          ? 'bg-sky-950 text-sky-300 border-b border-sky-800'
          : isCompleted
          ? 'bg-slate-800 text-slate-300 border-b border-slate-700'
          : 'bg-slate-950 text-slate-400 border-b border-slate-800'
      }`}>
        <span className="font-mono text-sky-400 font-bold">{worker.employeeId}</span>
        
        <div className="flex items-center gap-1.5">
          {isCheckedIn && (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              INSIDE FACTORY
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              CHECKED OUT
            </span>
          )}
          {isNotCheckedIn && (
            <span className="text-amber-400 font-normal">
              NOT ARRIVED
            </span>
          )}
        </div>
      </div>

      {/* Main Card Body */}
      <div className="p-4 flex items-start gap-4">
        {/* Worker Profile Photo */}
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800 shadow-md">
            <img
              src={worker.profilePhoto}
              alt={worker.fullName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          {isCheckedIn && (
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-black p-1 rounded-full shadow-md">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}
        </div>

        {/* Worker Details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base truncate leading-snug">
            {worker.fullName}
          </h3>

          <p className="text-xs text-sky-400 font-medium truncate mt-0.5">
            {worker.designation}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {worker.department} • <span className="font-mono text-slate-300">{worker.mobileNumber}</span>
          </p>

          {/* Assigned Working Time */}
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800/80">
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Working Time:</span>
            <span className="font-mono font-semibold text-emerald-300">
              {worker.workingTime || '09:00 AM – 07:00 PM'}
            </span>
          </div>

          {/* Today's Timestamps */}
          <div className="mt-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center gap-1">
              <span className="text-slate-500">In:</span>
              <span className={`font-mono font-semibold ${attendanceToday?.checkInTime ? 'text-emerald-400' : 'text-slate-500'}`}>
                {attendanceToday?.checkInTime || '--:--'}
              </span>
              {attendanceToday?.lateMinutes && attendanceToday.lateMinutes > 0 ? (
                <span className="text-[10px] text-rose-400 font-bold bg-rose-950/80 px-1 rounded border border-rose-800">
                  +{attendanceToday.lateMinutes}m Late
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-slate-500">Out:</span>
              <span className={`font-mono font-semibold ${attendanceToday?.checkOutTime ? 'text-sky-400' : 'text-slate-500'}`}>
                {attendanceToday?.checkOutTime || '--:--'}
              </span>
              {attendanceToday?.overtimeMinutes && attendanceToday.overtimeMinutes > 0 ? (
                <span className="text-[10px] text-amber-300 font-bold bg-amber-950/80 px-1 rounded border border-amber-800">
                  +{attendanceToday.overtimeMinutes}m OT
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Marked By Guard Sub-strip */}
      {attendanceToday?.checkInMarkedByGuardName && (
        <div className="px-4 py-1.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Marked By: <strong className="text-slate-200">{attendanceToday.checkInMarkedByGuardName}</strong>
          </span>
          {attendanceToday.checkInPhoto && onViewPhotoProof && (
            <button
              onClick={() => onViewPhotoProof(attendanceToday)}
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium cursor-pointer"
            >
              <Eye className="w-3 h-3" /> View Photo
            </button>
          )}
        </div>
      )}

      {/* Action Button Strip */}
      <div className="p-3 bg-slate-800/40 border-t border-slate-800">
        {isNotCheckedIn && (
          <button
            type="button"
            onClick={() => onInitiateCheckIn(worker)}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-md shadow-emerald-950 transition-all cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>CHECK-IN (GATE CAMERA)</span>
          </button>
        )}

        {isCheckedIn && (
          <div className="space-y-1.5">
            <div className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded text-center flex items-center justify-center gap-1 font-mono">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>Already Checked-In at {attendanceToday?.checkInTime}</span>
            </div>
            
            <button
              type="button"
              onClick={() => onInitiateCheckOut(worker, attendanceToday!)}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-md shadow-blue-950 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>CHECK-OUT (EXIT GATE)</span>
            </button>
          </div>
        )}

        {isCompleted && (
          <div className="w-full py-2 px-3 bg-slate-800 text-slate-400 font-semibold rounded-lg flex items-center justify-center gap-2 text-xs border border-slate-700/60 font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Duty Completed (Out: {attendanceToday?.checkOutTime})</span>
          </div>
        )}
      </div>

    </div>
  );
};
