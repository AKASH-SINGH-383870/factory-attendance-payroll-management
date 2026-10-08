import React, { useState } from 'react';
import {
  History,
  ShieldCheck,
  User,
  Clock,
  Search,
  Filter,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { SystemAuditLog } from '../../types';
import { StorageService } from '../../services/storage';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<SystemAuditLog[]>(StorageService.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'GUARD' | 'ADMIN'>('ALL');

  const filteredLogs = logs.filter(log => {
    if (roleFilter !== 'ALL' && log.actorRole !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.details.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        (log.targetWorkerName && log.targetWorkerName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-bold text-white">System Attendance Audit Trail</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete immutable ledger of all gate security check-ins, exits, worker updates, and administrative overrides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800">
            {logs.length} Total Audit Entries
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by worker name, guard name, or event details..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400">Actor Role:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Roles</option>
            <option value="GUARD">Security Guard Only</option>
            <option value="ADMIN">Administrator Only</option>
          </select>
        </div>
      </div>

      {/* Audit List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 overflow-hidden shadow-xl">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No audit logs match current query.
          </div>
        ) : (
          filteredLogs.map(log => {
            const isGuard = log.actorRole === 'GUARD';
            return (
              <div key={log.id} className="p-4 hover:bg-slate-800/40 transition-colors flex items-start gap-4">
                
                {/* Icon Badge */}
                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 border ${
                  isGuard 
                    ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-400' 
                    : 'bg-amber-950/80 border-amber-700/60 text-amber-400'
                }`}>
                  {isGuard ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        isGuard 
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}>
                        {log.actionType.replace(/_/g, ' ')}
                      </span>

                      <span className="text-xs text-slate-300 font-semibold">
                        {log.actorName} <span className="text-slate-500 font-mono">({log.actorId})</span>
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {log.details}
                  </p>

                  {log.targetWorkerName && (
                    <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                      <span className="text-slate-500">Target Worker:</span>
                      <strong className="text-white">{log.targetWorkerName}</strong>
                    </div>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
