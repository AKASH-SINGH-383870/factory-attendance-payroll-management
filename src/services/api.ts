import {
  Worker,
  GuardUser,
  AttendanceRecord,
  AttendanceRulesConfig,
  PayrollRecord,
  SystemAuditLog,
  ReportSummaryMetrics,
  AdvanceTransaction,
  AdvancePayrollDeduction,
  AdvanceDashboardStats,
  WorkerAdvanceSummary,
} from '../types';
import { StorageService } from './storage';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export const ApiService = {
  // ================= WORKERS =================
  async getWorkers(): Promise<Worker[]> {
    try {
      const data = await fetchJson<Worker[]>(`${API_BASE}/workers`);
      // Update local storage cache
      localStorage.setItem('gatepass_workers', JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn('Backend API unavailable, falling back to local storage cache:', err);
      return StorageService.getWorkers();
    }
  },

  async createWorker(worker: Omit<Worker, 'id'> & { id?: string }): Promise<Worker> {
    try {
      const created = await fetchJson<Worker>(`${API_BASE}/workers`, {
        method: 'POST',
        body: JSON.stringify(worker),
      });
      StorageService.saveWorker(created);
      return created;
    } catch (err) {
      console.warn('API error creating worker, falling back to local storage:', err);
      const fallback: Worker = {
        ...worker,
        id: worker.id || `worker-${Date.now()}`,
        recordSource: 'live',
      };
      StorageService.saveWorker(fallback);
      return fallback;
    }
  },

  async updateWorker(id: string, updates: Partial<Worker>): Promise<Worker> {
    try {
      const updated = await fetchJson<Worker>(`${API_BASE}/workers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      StorageService.saveWorker(updated);
      return updated;
    } catch (err) {
      console.warn('API error updating worker, falling back to local storage:', err);
      const list = StorageService.getWorkers();
      const existing = list.find(w => w.id === id);
      if (!existing) throw err;
      const updated = { ...existing, ...updates };
      StorageService.saveWorker(updated);
      return updated;
    }
  },

  async deleteWorker(id: string): Promise<boolean> {
    try {
      await fetchJson<{ success: boolean }>(`${API_BASE}/workers/${id}`, {
        method: 'DELETE',
      });
      StorageService.deleteWorker(id);
      return true;
    } catch (err) {
      console.warn('API error deleting worker, falling back to local storage:', err);
      StorageService.deleteWorker(id);
      return true;
    }
  },

  // ================= GUARDS =================
  async getGuards(): Promise<GuardUser[]> {
    try {
      const data = await fetchJson<GuardUser[]>(`${API_BASE}/guards`);
      localStorage.setItem('gatepass_guards', JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn('API error getting guards, falling back to local storage:', err);
      return StorageService.getGuards();
    }
  },

  async createGuard(guard: Omit<GuardUser, 'id'> & { id?: string }): Promise<GuardUser> {
    try {
      const created = await fetchJson<GuardUser>(`${API_BASE}/guards`, {
        method: 'POST',
        body: JSON.stringify(guard),
      });
      StorageService.saveGuard(created);
      return created;
    } catch (err) {
      console.warn('API error creating guard, falling back to local storage:', err);
      const fallback: GuardUser = {
        ...guard,
        id: guard.id || `guard-${Date.now()}`,
        recordSource: 'live',
      };
      StorageService.saveGuard(fallback);
      return fallback;
    }
  },

  async updateGuard(id: string, updates: Partial<GuardUser>): Promise<GuardUser> {
    try {
      const updated = await fetchJson<GuardUser>(`${API_BASE}/guards/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      StorageService.saveGuard(updated);
      return updated;
    } catch (err) {
      console.warn('API error updating guard, falling back to local storage:', err);
      const list = StorageService.getGuards();
      const existing = list.find(g => g.id === id);
      if (!existing) throw err;
      const updated = { ...existing, ...updates };
      StorageService.saveGuard(updated);
      return updated;
    }
  },

  async toggleGuardStatus(id: string): Promise<GuardUser | null> {
    try {
      const updated = await fetchJson<GuardUser>(`${API_BASE}/guards/${id}/status`, {
        method: 'PATCH',
      });
      StorageService.saveGuard(updated);
      return updated;
    } catch (err) {
      console.warn('API error toggling guard status, falling back to local storage:', err);
      StorageService.toggleGuardStatus(id);
      return StorageService.getGuards().find(g => g.id === id) || null;
    }
  },

  // ================= ATTENDANCE =================
  async getAttendance(filters?: { date?: string; month?: string; workerId?: string; status?: string }): Promise<AttendanceRecord[]> {
    try {
      const query = new URLSearchParams();
      if (filters?.date) query.set('date', filters.date);
      if (filters?.month) query.set('month', filters.month);
      if (filters?.workerId) query.set('workerId', filters.workerId);
      if (filters?.status) query.set('status', filters.status);

      const data = await fetchJson<AttendanceRecord[]>(`${API_BASE}/attendance?${query.toString()}`);
      localStorage.setItem('gatepass_attendance', JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn('API error getting attendance, falling back to local storage:', err);
      let list = StorageService.getAttendance();
      if (filters?.date) list = list.filter(a => a.date === filters.date);
      if (filters?.month) list = list.filter(a => a.date.startsWith(filters.month!));
      if (filters?.workerId) list = list.filter(a => a.workerId === filters.workerId);
      if (filters?.status) list = list.filter(a => a.status === filters.status);
      return list;
    }
  },

  async checkIn(payload: {
    workerId: string;
    photoDataUrl: string;
    guardId: string;
    guardName: string;
    gateName: string;
  }): Promise<AttendanceRecord> {
    try {
      const record = await fetchJson<AttendanceRecord>(`${API_BASE}/attendance/check-in`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      StorageService.saveAttendanceRecord(record);
      return record;
    } catch (err) {
      console.warn('API error during check-in, using local storage fallback:', err);
      throw err;
    }
  },

  async checkOut(payload: {
    workerId: string;
    photoDataUrl?: string;
    guardId: string;
    guardName: string;
    gateName: string;
  }): Promise<AttendanceRecord> {
    try {
      const record = await fetchJson<AttendanceRecord>(`${API_BASE}/attendance/check-out`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      StorageService.saveAttendanceRecord(record);
      return record;
    } catch (err) {
      console.warn('API error during check-out, using local storage fallback:', err);
      throw err;
    }
  },

  async adminOverrideAttendance(
    recordId: string,
    updates: Partial<AttendanceRecord>,
    adminName: string,
    reason: string
  ): Promise<AttendanceRecord> {
    try {
      const record = await fetchJson<AttendanceRecord>(`${API_BASE}/attendance/override`, {
        method: 'POST',
        body: JSON.stringify({ recordId, updates, adminName, reason }),
      });
      StorageService.saveAttendanceRecord(record);
      return record;
    } catch (err) {
      console.warn('API error overriding attendance, falling back to local storage:', err);
      StorageService.adminOverrideAttendance(recordId, updates, adminName, reason);
      return StorageService.getAttendance().find(a => a.id === recordId)!;
    }
  },

  // ================= RULES =================
  async getRules(): Promise<AttendanceRulesConfig> {
    try {
      const rules = await fetchJson<AttendanceRulesConfig>(`${API_BASE}/rules`);
      StorageService.saveRules(rules);
      return rules;
    } catch (err) {
      console.warn('API error getting rules, falling back to local storage:', err);
      return StorageService.getRules();
    }
  },

  async updateRules(rules: AttendanceRulesConfig): Promise<AttendanceRulesConfig> {
    try {
      const updated = await fetchJson<AttendanceRulesConfig>(`${API_BASE}/rules`, {
        method: 'PUT',
        body: JSON.stringify(rules),
      });
      StorageService.saveRules(updated);
      return updated;
    } catch (err) {
      console.warn('API error updating rules, falling back to local storage:', err);
      StorageService.saveRules(rules);
      return rules;
    }
  },

  // ================= PAYROLL =================
  async getPayroll(month: string = '2026-10'): Promise<PayrollRecord[]> {
    try {
      const records = await fetchJson<PayrollRecord[]>(`${API_BASE}/payroll?month=${month}`);
      StorageService.savePayrollRecords(records);
      return records;
    } catch (err) {
      console.warn('API error getting payroll, falling back to local storage:', err);
      return StorageService.getPayrollRecords();
    }
  },

  async recalculatePayroll(month: string = '2026-10'): Promise<PayrollRecord[]> {
    try {
      const recalculated = await fetchJson<PayrollRecord[]>(`${API_BASE}/payroll/calculate`, {
        method: 'POST',
        body: JSON.stringify({ month }),
      });
      StorageService.savePayrollRecords(recalculated);
      return recalculated;
    } catch (err) {
      console.warn('API error recalculating payroll, falling back to local calculation:', err);
      return StorageService.getPayrollRecords();
    }
  },

  async markPayrollPaid(id: string): Promise<PayrollRecord> {
    try {
      return await fetchJson<PayrollRecord>(`${API_BASE}/payroll/${id}/pay`, {
        method: 'PATCH',
      });
    } catch (err) {
      console.warn('API error marking payroll paid:', err);
      const records = StorageService.getPayrollRecords();
      const rec = records.find(r => r.id === id);
      if (rec) {
        rec.paymentStatus = 'PAID';
        rec.paidAt = new Date().toISOString();
        StorageService.savePayrollRecords(records);
        return rec;
      }
      throw err;
    }
  },

  // ================= REPORTS =================
  async getReports(month: string = '2026-10'): Promise<{
    month: string;
    summary: ReportSummaryMetrics;
    lateRecords: any[];
    absentRecords: any[];
    otRecords: any[];
    workerMonthlyMatrix: PayrollRecord[];
  }> {
    try {
      return await fetchJson(`${API_BASE}/reports?month=${month}`);
    } catch (err) {
      console.warn('API error fetching reports, calculating client-side fallback:', err);
      // Client-side calculation fallback
      const workers = StorageService.getWorkers();
      const attendance = StorageService.getAttendance().filter(a => a.date.startsWith(month));
      const payroll = StorageService.getPayrollRecords();
      
      const lateRecords = attendance
        .filter(a => (a.lateMinutes || 0) > 0)
        .map(a => {
          const w = workers.find(worker => worker.id === a.workerId);
          const perMin = ((w?.monthlySalary || 15000) / 30) / (a.workingTime.includes('05:00') ? 480 : a.workingTime.includes('09:00 PM') ? 720 : 600);
          return {
            id: a.id,
            date: a.date,
            workerId: a.workerId,
            workerName: a.workerName,
            employeeId: a.workerEmployeeId,
            department: w?.department || 'Production',
            workingTime: a.workingTime,
            checkInTime: a.checkInTime,
            lateMinutes: a.lateMinutes,
            deductionAmount: Math.round(a.lateMinutes * perMin * 100) / 100,
            guardName: a.checkInMarkedByGuardName,
            gate: a.checkInGate,
            recordSource: a.recordSource || 'seed',
          };
        });

      const absentRecords = attendance
        .filter(a => a.status === 'ABSENT')
        .map(a => {
          const w = workers.find(worker => worker.id === a.workerId);
          return {
            id: a.id,
            date: a.date,
            workerId: a.workerId,
            workerName: a.workerName,
            employeeId: a.workerEmployeeId,
            department: w?.department || 'Production',
            workingTime: a.workingTime,
            deductionAmount: Math.round(((w?.monthlySalary || 15000) / 30) * 100) / 100,
            guardName: a.checkInMarkedByGuardName || 'Gate',
            recordSource: a.recordSource || 'seed',
          };
        });

      const otRecords = attendance
        .filter(a => (a.overtimeMinutes || 0) > 0)
        .map(a => {
          const w = workers.find(worker => worker.id === a.workerId);
          const perMin = ((w?.monthlySalary || 15000) / 30) / (a.workingTime.includes('05:00') ? 480 : a.workingTime.includes('09:00 PM') ? 720 : 600);
          return {
            id: a.id,
            date: a.date,
            workerId: a.workerId,
            workerName: a.workerName,
            employeeId: a.workerEmployeeId,
            department: w?.department || 'Production',
            workingTime: a.workingTime,
            checkOutTime: a.checkOutTime,
            workingEndTime: a.workingEndTime,
            overtimeMinutes: a.overtimeMinutes,
            otPayAmount: Math.round(a.overtimeMinutes * perMin * 100) / 100,
            guardName: a.checkOutMarkedByGuardName || a.checkInMarkedByGuardName,
            gate: a.checkOutGate || a.checkInGate,
            recordSource: a.recordSource || 'seed',
          };
        });

      return {
        month,
        summary: {
          month,
          totalWorkers: workers.length,
          totalPresentDays: payroll.reduce((s, p) => s + (p.daysPresent || 0), 0),
          totalAbsentDays: payroll.reduce((s, p) => s + (p.daysAbsent || 0), 0),
          totalLateMinutes: payroll.reduce((s, p) => s + (p.totalLateMinutes || 0), 0),
          totalLateDeductions: Math.round(payroll.reduce((s, p) => s + (p.totalLateDeduction || 0), 0) * 100) / 100,
          totalOtMinutes: payroll.reduce((s, p) => s + (p.totalOtMinutes || 0), 0),
          totalOtPaid: Math.round(payroll.reduce((s, p) => s + (p.totalOtPay || 0), 0) * 100) / 100,
          totalEarlyExitMinutes: payroll.reduce((s, p) => s + (p.totalEarlyExitMinutes || 0), 0),
          totalEarlyExitDeductions: Math.round(payroll.reduce((s, p) => s + (p.totalEarlyExitDeduction || 0), 0) * 100) / 100,
          totalWageLiability: Math.round(payroll.reduce((s, p) => s + (p.netSalary || 0), 0) * 100) / 100,
        },
        lateRecords,
        absentRecords,
        otRecords,
        workerMonthlyMatrix: payroll,
      };
    }
  },

  // ================= ADVANCES =================
  async getAdvances(filters?: {
    workerId?: string;
    month?: string;
    status?: string;
    paymentMode?: string;
    search?: string;
  }): Promise<AdvanceTransaction[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.workerId) params.append('workerId', filters.workerId);
      if (filters?.month) params.append('month', filters.month);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.paymentMode) params.append('paymentMode', filters.paymentMode);
      if (filters?.search) params.append('search', filters.search);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const list = await fetchJson<AdvanceTransaction[]>(`${API_BASE}/advances${qs}`);
      localStorage.setItem('gatepass_advances', JSON.stringify(list));
      return list;
    } catch (err) {
      console.warn('API error getting advances, using storage fallback:', err);
      let list = StorageService.getAdvances();
      if (filters?.workerId) list = list.filter(a => a.workerId === filters.workerId);
      if (filters?.month) {
        const targetMonth = filters.month;
        list = list.filter(a => a.salaryMonth === targetMonth || a.advanceDate.startsWith(targetMonth));
      }
      if (filters?.status && filters.status !== 'ALL') list = list.filter(a => a.status === filters.status);
      if (filters?.paymentMode && filters.paymentMode !== 'ALL') list = list.filter(a => a.paymentMode === filters.paymentMode);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(
          a =>
            a.workerName.toLowerCase().includes(q) ||
            a.employeeId.toLowerCase().includes(q) ||
            a.transactionNumber.toLowerCase().includes(q)
        );
      }
      return list;
    }
  },

  async getAdvanceStats(month: string = '2026-10'): Promise<AdvanceDashboardStats> {
    try {
      return await fetchJson<AdvanceDashboardStats>(`${API_BASE}/advances/stats?month=${month}`);
    } catch (err) {
      console.warn('API error getting advance stats, computing fallback:', err);
      const advances = StorageService.getAdvances();
      const deductions = StorageService.getAdvanceDeductions();
      const monthAdvances = advances.filter(
        a => (a.salaryMonth === month || a.advanceDate.startsWith(month)) && a.status !== 'VOIDED'
      );
      const workerIds = new Set(monthAdvances.map(a => a.workerId));
      return {
        month,
        totalAdvancePaidMonth: monthAdvances.reduce((s, a) => s + a.amount, 0),
        totalWorkersWithAdvance: workerIds.size,
        totalAdvanceTransactions: monthAdvances.length,
        outstandingAdvanceBalance: advances
          .filter(a => a.status !== 'VOIDED')
          .reduce((s, a) => s + (a.remainingAmount || 0), 0),
        monthAdvanceDeductions: deductions
          .filter(d => d.month === month)
          .reduce((s, d) => s + d.deductedAmount, 0),
        recentTransactions: advances.slice(0, 10),
      };
    }
  },

  async getWorkerAdvanceSummary(workerId: string): Promise<WorkerAdvanceSummary> {
    try {
      return await fetchJson<WorkerAdvanceSummary>(`${API_BASE}/advances/worker/${workerId}`);
    } catch (err) {
      console.warn('API error getting worker advance summary, computing fallback:', err);
      const workers = StorageService.getWorkers();
      const worker = workers.find(w => w.id === workerId);
      const transactions = StorageService.getAdvances()
        .filter(a => a.workerId === workerId)
        .sort((a, b) => b.advanceDate.localeCompare(a.advanceDate));
      const deductions = StorageService.getAdvanceDeductions()
        .filter(d => d.workerId === workerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const validTx = transactions.filter(a => a.status !== 'VOIDED');
      return {
        workerId: worker?.id || workerId,
        workerName: worker?.fullName || 'Worker',
        employeeId: worker?.employeeId || 'EMP-000',
        profilePhoto: worker?.profilePhoto || '',
        department: worker?.department || 'Production',
        monthlySalary: worker?.monthlySalary || 15000,
        totalAdvanceReceived: validTx.reduce((s, a) => s + a.amount, 0),
        currentMonthAdvance: validTx
          .filter(a => a.salaryMonth === '2026-10' || a.advanceDate.startsWith('2026-10'))
          .reduce((s, a) => s + a.amount, 0),
        totalAdvanceDeducted: deductions.reduce((s, d) => s + d.deductedAmount, 0),
        outstandingBalance: validTx.reduce((s, a) => s + (a.remainingAmount || 0), 0),
        transactions,
        deductions,
      };
    }
  },

  async createAdvance(payload: {
    workerId: string;
    amount: number;
    advanceDate: string;
    salaryMonth?: string;
    paymentMode: 'Cash' | 'UPI' | 'Bank Transfer';
    paymentReference?: string;
    remarks?: string;
    createdBy?: string;
  }): Promise<AdvanceTransaction> {
    try {
      const created = await fetchJson<AdvanceTransaction>(`${API_BASE}/advances`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      StorageService.saveAdvance(created);
      return created;
    } catch (err) {
      console.warn('API error creating advance, saving to storage fallback:', err);
      const workers = StorageService.getWorkers();
      const worker = workers.find(w => w.id === payload.workerId);
      const advances = StorageService.getAdvances();
      const count = advances.length + 1;
      const transactionNumber = `ADV-${String(count).padStart(3, '0')}`;
      const now = new Date().toISOString();
      const fallback: AdvanceTransaction = {
        id: `adv-${Date.now()}`,
        transactionNumber,
        workerId: payload.workerId,
        workerName: worker?.fullName || 'Worker',
        employeeId: worker?.employeeId || 'EMP-000',
        amount: Number(payload.amount),
        advanceDate: payload.advanceDate,
        salaryMonth: payload.salaryMonth || payload.advanceDate.substring(0, 7),
        paymentMode: payload.paymentMode,
        paymentReference: payload.paymentReference,
        remarks: payload.remarks,
        status: 'ACTIVE',
        deductedAmount: 0,
        remainingAmount: Number(payload.amount),
        recordSource: 'live',
        createdBy: payload.createdBy || 'Factory Superintendent / HR Admin',
        createdAt: now,
        updatedAt: now,
      };
      StorageService.saveAdvance(fallback);
      return fallback;
    }
  },

  async updateAdvance(
    id: string,
    updates: Partial<{
      amount: number;
      advanceDate: string;
      salaryMonth: string;
      paymentMode: 'Cash' | 'UPI' | 'Bank Transfer';
      paymentReference: string;
      remarks: string;
      updatedBy: string;
    }>
  ): Promise<AdvanceTransaction> {
    try {
      const updated = await fetchJson<AdvanceTransaction>(`${API_BASE}/advances/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      StorageService.saveAdvance(updated);
      return updated;
    } catch (err) {
      console.warn('API error updating advance, updating in storage fallback:', err);
      const advances = StorageService.getAdvances();
      const adv = advances.find(a => a.id === id);
      if (!adv) throw err;
      const updated: AdvanceTransaction = {
        ...adv,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveAdvance(updated);
      return updated;
    }
  },

  async voidAdvance(id: string, voidedBy: string, reason: string): Promise<AdvanceTransaction> {
    try {
      const voided = await fetchJson<AdvanceTransaction>(`${API_BASE}/advances/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ voidedBy, reason }),
      });
      StorageService.voidAdvance(id, voidedBy, reason);
      return voided;
    } catch (err) {
      console.warn('API error voiding advance, updating storage fallback:', err);
      StorageService.voidAdvance(id, voidedBy, reason);
      const adv = StorageService.getAdvances().find(a => a.id === id);
      if (!adv) throw err;
      return adv;
    }
  },

  // ================= DASHBOARD STATS =================
  async getDashboardStats(date: string = '2026-10-08', month: string = '2026-10') {
    try {
      return await fetchJson<any>(`${API_BASE}/stats?date=${date}&month=${month}`);
    } catch (err) {
      console.warn('API error getting stats, computing fallback:', err);
      const workers = StorageService.getWorkers();
      const guards = StorageService.getGuards();
      const attendanceToday = StorageService.getAttendanceForDate(date);

      return {
        date,
        month,
        totalWorkers: workers.length,
        insideFactory: attendanceToday.filter(a => a.checkInTime && !a.checkOutTime).length,
        checkedInToday: attendanceToday.filter(a => Boolean(a.checkInTime)).length,
        lateToday: attendanceToday.filter(a => (a.lateMinutes || 0) > 0).length,
        completedToday: attendanceToday.filter(a => Boolean(a.checkOutTime)).length,
        absentToday: attendanceToday.filter(a => a.status === 'ABSENT').length,
        activeGuards: guards.filter(g => g.status === 'ACTIVE').length,
        totalWageLiability: workers.reduce((s, w) => s + (w.monthlySalary || 0), 0),
        todayRoll: attendanceToday.slice(0, 10),
        recentAuditLogs: StorageService.getAuditLogs().slice(0, 8),
      };
    }
  },

  // ================= AUDIT LOGS =================
  async getAuditLogs(): Promise<SystemAuditLog[]> {
    try {
      return await fetchJson<SystemAuditLog[]>(`${API_BASE}/audit-logs`);
    } catch (err) {
      console.warn('API error getting audit logs, falling back to local storage:', err);
      return StorageService.getAuditLogs();
    }
  },

  // ================= DATABASE RESET =================
  async resetDatabase(): Promise<void> {
    try {
      await fetchJson(`${API_BASE}/database/reset`, { method: 'POST' });
    } catch (err) {
      console.warn('API reset error, resetting local storage:', err);
    }
    StorageService.resetAllToDefaults();
  },
};
