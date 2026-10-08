import React, { useState } from 'react';
import {
  Settings,
  Clock,
  Coins,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Building,
  Info,
} from 'lucide-react';
import { AttendanceRulesConfig } from '../../types';
import { StorageService } from '../../services/storage';
import { WORKING_TIME_OPTIONS } from '../../utils/timeCalculations';

interface AttendanceRulesConfigProps {
  onDataChanged: () => void;
}

export const AttendanceRulesConfigView: React.FC<AttendanceRulesConfigProps> = ({
  onDataChanged,
}) => {
  const [rules, setRules] = useState<AttendanceRulesConfig>(StorageService.getRules());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveRules(rules);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    onDataChanged();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white">Factory Working Times & 30-Day Salary Policies</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configured according to factory rules: 30-day default salary basis, individual worker working times, and overtime starting after duty end.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 bg-emerald-950 border border-emerald-600 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Attendance Policies Updated</span>
          </div>
        )}
      </div>

      {/* FACTORY 3 WORKING TIME STANDARDS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Standard Factory Working Times</h3>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
            Assigned Directly in Worker Profile
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {WORKING_TIME_OPTIONS.map((timeOpt, idx) => (
            <div
              key={timeOpt.label}
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Working Time {idx + 1}
                  </span>
                  <span className="text-xs font-mono bg-slate-900 text-sky-400 px-2 py-0.5 rounded border border-slate-800">
                    {timeOpt.normalWorkingHours} Hours Duty
                  </span>
                </div>

                <h4 className="font-bold text-white text-lg font-mono mt-2">
                  {timeOpt.label}
                </h4>

                <div className="mt-3 text-xs space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Working Start Time:</span>
                    <span className="font-semibold text-white font-mono">09:00 AM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Normal Duty End Time:</span>
                    <span className="font-semibold text-amber-400 font-mono">{timeOpt.endTime12}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Normal Working Duration:</span>
                    <span className="font-semibold text-white font-mono">{timeOpt.normalWorkingMinutes} Minutes</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-500">Overtime Trigger:</span>
                    <span className="font-semibold text-emerald-400">After {timeOpt.endTime12}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SALARY & ATTENDANCE POLICY FORM */}
      <form onSubmit={handleSaveRules} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-xl">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* LEFT: 30-DAY SALARY BASIS & LATE DEDUCTION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Coins className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base">Monthly Salary & Late Deduction Rules</h3>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Default Monthly Salary Basis</span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                  30 CALENDAR DAYS (LOCKED)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Formula: <strong>Per Day Salary = Monthly Salary ÷ 30</strong>. If worker is absent for 1 day, only that 1 day’s salary is deducted. No 24-day or 26-day basis is used.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Late Check-In Grace Period (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={rules.gracePeriodMinutes}
                onChange={e => setRules({ ...rules, gracePeriodMinutes: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Default: 0 mins. Late deduction is calculated on exact actual late minutes (Per Minute Salary × Late Minutes).
              </span>
            </div>
          </div>

          {/* RIGHT: OVERTIME & CAMERA VERIFICATION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Shield className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold text-white text-base">Overtime (OT) & Camera Settings</h3>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Overtime Hourly / Minute Rate Multiplier
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="2.5"
                value={rules.otRateMultiplier}
                onChange={e => setRules({ ...rules, otRateMultiplier: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                1.0x (normal per-minute rate) or 1.5x. Overtime starts ONLY after that particular worker's assigned normal Working End Time.
              </span>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rules.requireCheckOutPhoto}
                  onChange={e => setRules({ ...rules, requireCheckOutPhoto: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Require Live Photo at Gate Check-Out Exit
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Security guard must capture exit photo with stamped date & time before confirming check-out.
                  </span>
                </div>
              </label>
            </div>
          </div>

        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Factory Attendance Policies</span>
          </button>
        </div>

      </form>

    </div>
  );
};
