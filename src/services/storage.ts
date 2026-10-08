import {
  GuardUser,
  Worker,
  AttendanceRecord,
  AttendanceRulesConfig,
  SystemAuditLog,
  CurrentUserSession,
  PayrollRecord,
  AdvanceTransaction,
  AdvancePayrollDeduction,
} from '../types';
import {
  INITIAL_GUARDS,
  INITIAL_RULES,
  INITIAL_WORKERS,
  INITIAL_ATTENDANCE,
  INITIAL_AUDIT_LOGS,
  INITIAL_PAYROLL,
  INITIAL_ADVANCES,
  INITIAL_ADVANCE_DEDUCTIONS,
  getTodayDateString,
} from '../data/mockData';

const KEYS = {
  GUARDS: 'gatepass_guards',
  RULES: 'gatepass_rules',
  WORKERS: 'gatepass_workers',
  ATTENDANCE: 'gatepass_attendance',
  AUDIT: 'gatepass_audit_logs',
  SESSION: 'gatepass_session',
  PAYROLL: 'gatepass_payroll',
  ADVANCES: 'gatepass_advances',
  ADVANCE_DEDUCTIONS: 'gatepass_advance_deductions',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error loading key ${key}:`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving key ${key}:`, e);
  }
}

export const StorageService = {
  // --- GUARDS ---
  getGuards(): GuardUser[] {
    return loadFromStorage<GuardUser[]>(KEYS.GUARDS, INITIAL_GUARDS);
  },
  saveGuard(guard: GuardUser): void {
    const list = this.getGuards();
    const idx = list.findIndex(g => g.id === guard.id);
    if (idx >= 0) {
      list[idx] = guard;
    } else {
      list.push(guard);
    }
    saveToStorage(KEYS.GUARDS, list);
    this.addAuditLog({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: 'System Admin',
      actionType: 'GUARD_CREATED',
      details: `Guard account ${guard.fullName} (${guard.guardId}) was saved. Assigned to ${guard.gateAssigned}.`,
    });
  },
  toggleGuardStatus(guardId: string): void {
    const list = this.getGuards();
    const guard = list.find(g => g.id === guardId);
    if (guard) {
      guard.status = guard.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      saveToStorage(KEYS.GUARDS, list);
    }
  },

  // --- RULES ---
  getRules(): AttendanceRulesConfig {
    return loadFromStorage<AttendanceRulesConfig>(KEYS.RULES, INITIAL_RULES);
  },
  saveRules(rules: AttendanceRulesConfig): void {
    saveToStorage(KEYS.RULES, rules);
    this.addAuditLog({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: 'System Admin',
      actionType: 'RULES_UPDATED',
      details: `Factory attendance policies and overtime rules updated by Admin. (Basis: 30 Days).`,
    });
  },

  // --- WORKERS ---
  getWorkers(): Worker[] {
    const raw = loadFromStorage<Worker[]>(KEYS.WORKERS, INITIAL_WORKERS);
    if (!Array.isArray(raw) || raw.length === 0) {
      return INITIAL_WORKERS;
    }
    return raw
      .filter(w => w && typeof w === 'object' && w.id)
      .map(w => ({
        ...w,
        fullName: w.fullName || 'Worker',
        employeeId: w.employeeId || 'EMP-000',
        workingTime: w.workingTime || '09:00 AM – 07:00 PM',
        monthlySalary: typeof w.monthlySalary === 'number' && !isNaN(w.monthlySalary) ? w.monthlySalary : 15000,
        profilePhoto: w.profilePhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
        department: w.department || 'Production',
        designation: w.designation || 'Factory Worker',
        status: w.status || 'ACTIVE',
        documents: Array.isArray(w.documents) ? w.documents : [],
      }));
  },
  saveWorker(worker: Worker): void {
    const list = this.getWorkers();
    const idx = list.findIndex(w => w.id === worker.id);
    const isNew = idx < 0;
    if (isNew) {
      list.push(worker);
    } else {
      list[idx] = worker;
    }
    saveToStorage(KEYS.WORKERS, list);
    this.addAuditLog({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: 'System Admin',
      actionType: isNew ? 'WORKER_CREATED' : 'WORKER_UPDATED',
      details: `Worker ${worker.fullName} (${worker.employeeId}) profile ${isNew ? 'created' : 'updated'}. Working Time: ${worker.workingTime}. Base Salary: ₹${worker.monthlySalary}.`,
      targetWorkerId: worker.id,
      targetWorkerName: worker.fullName,
    });
  },
  deleteWorker(workerId: string): void {
    const list = this.getWorkers().filter(w => w.id !== workerId);
    saveToStorage(KEYS.WORKERS, list);
  },

  // --- ATTENDANCE ---
  getAttendance(): AttendanceRecord[] {
    const raw = loadFromStorage<AttendanceRecord[]>(KEYS.ATTENDANCE, INITIAL_ATTENDANCE);
    if (!Array.isArray(raw) || raw.length === 0) {
      return INITIAL_ATTENDANCE;
    }
    return raw
      .filter(a => a && typeof a === 'object' && a.id)
      .map(a => ({
        ...a,
        workingTime: a.workingTime || '09:00 AM – 07:00 PM',
        workingStartTime: a.workingStartTime || '09:00 AM',
        workingEndTime: a.workingEndTime || '07:00 PM',
        lateMinutes: typeof a.lateMinutes === 'number' && !isNaN(a.lateMinutes) ? a.lateMinutes : 0,
        earlyExitMinutes: typeof a.earlyExitMinutes === 'number' && !isNaN(a.earlyExitMinutes) ? a.earlyExitMinutes : 0,
        overtimeMinutes: typeof a.overtimeMinutes === 'number' && !isNaN(a.overtimeMinutes) ? a.overtimeMinutes : 0,
        totalWorkingMinutes: typeof a.totalWorkingMinutes === 'number' && !isNaN(a.totalWorkingMinutes) ? a.totalWorkingMinutes : 0,
        status: a.status || 'PRESENT',
      }));
  },
  getAttendanceForDate(dateStr: string = getTodayDateString()): AttendanceRecord[] {
    const all = this.getAttendance();
    return all.filter(a => a.date === dateStr);
  },
  getWorkerAttendanceToday(workerId: string, dateStr: string = getTodayDateString()): AttendanceRecord | undefined {
    return this.getAttendance().find(a => a.workerId === workerId && a.date === dateStr);
  },
  saveAttendanceRecord(record: AttendanceRecord): void {
    const list = this.getAttendance();
    const idx = list.findIndex(a => a.id === record.id);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record); // Prepend so newest appears first
    }
    saveToStorage(KEYS.ATTENDANCE, list);
  },

  // --- ADMIN MANUAL OVERRIDE WITH AUDIT ---
  adminOverrideAttendance(
    recordId: string,
    updates: Partial<AttendanceRecord>,
    adminName: string,
    reason: string
  ): void {
    const list = this.getAttendance();
    const record = list.find(r => r.id === recordId);
    if (!record) return;

    const historyEntry = {
      modifiedAt: new Date().toISOString(),
      modifiedByAdminName: adminName,
      reason,
      fieldChanged: Object.keys(updates).join(', '),
      oldValue: `In: ${record.checkInTime || '-'}, Out: ${record.checkOutTime || '-'}, Status: ${record.status}`,
      newValue: `In: ${updates.checkInTime ?? record.checkInTime}, Out: ${updates.checkOutTime ?? record.checkOutTime}, Status: ${updates.status ?? record.status}`,
    };

    record.modificationHistory = record.modificationHistory || [];
    record.modificationHistory.push(historyEntry);
    record.isManuallyModified = true;
    record.updatedAt = new Date().toISOString();

    Object.assign(record, updates);
    saveToStorage(KEYS.ATTENDANCE, list);

    this.addAuditLog({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: adminName,
      actionType: 'ATTENDANCE_OVERRIDE',
      details: `Admin modified attendance for ${record.workerName} (${record.workerEmployeeId}) on ${record.date}. Reason: ${reason}`,
      targetWorkerId: record.workerId,
      targetWorkerName: record.workerName,
    });
  },

  // --- AUDIT LOGS ---
  getAuditLogs(): SystemAuditLog[] {
    return loadFromStorage<SystemAuditLog[]>(KEYS.AUDIT, INITIAL_AUDIT_LOGS);
  },
  addAuditLog(log: SystemAuditLog): void {
    const list = this.getAuditLogs();
    list.unshift(log); // newest first
    saveToStorage(KEYS.AUDIT, list.slice(0, 500));
  },

  // --- PAYROLL RECORDS ---
  getPayrollRecords(): PayrollRecord[] {
    const raw = loadFromStorage<PayrollRecord[]>(KEYS.PAYROLL, INITIAL_PAYROLL);
    if (!Array.isArray(raw) || raw.length === 0) {
      return INITIAL_PAYROLL;
    }
    // Defensive upgrade for any legacy records missing new fields
    return raw
      .filter(r => r && typeof r === 'object' && r.id)
      .map(r => {
        const baseSalary = typeof r.baseSalary === 'number' && !isNaN(r.baseSalary) ? r.baseSalary : 15000;
        const dailyWage = typeof r.dailyWage === 'number' && !isNaN(r.dailyWage) ? r.dailyWage : baseSalary / 30;
        const normalMins = typeof r.normalWorkingMinutesPerDay === 'number' && !isNaN(r.normalWorkingMinutesPerDay) ? r.normalWorkingMinutesPerDay : 600;
        const perMinuteSalary = typeof r.perMinuteSalary === 'number' && !isNaN(r.perMinuteSalary) ? r.perMinuteSalary : dailyWage / normalMins;
        const workingTime = r.workingTime || '09:00 AM – 07:00 PM';
        return {
          ...r,
          workerName: r.workerName || 'Worker',
          employeeId: r.employeeId || 'EMP-000',
          month: r.month || '2026-10',
          department: r.department || 'Production',
          baseSalary,
          salaryBasisDays: 30,
          dailyWage,
          normalWorkingMinutesPerDay: normalMins,
          perMinuteSalary,
          workingTime,
          daysPresent: typeof r.daysPresent === 'number' && !isNaN(r.daysPresent) ? r.daysPresent : 30,
          daysAbsent: typeof r.daysAbsent === 'number' && !isNaN(r.daysAbsent) ? r.daysAbsent : 0,
          absentDeduction: typeof r.absentDeduction === 'number' && !isNaN(r.absentDeduction) ? r.absentDeduction : 0,
          totalLateMinutes: typeof r.totalLateMinutes === 'number' && !isNaN(r.totalLateMinutes) ? r.totalLateMinutes : 0,
          totalLateDeduction: typeof r.totalLateDeduction === 'number' && !isNaN(r.totalLateDeduction) ? r.totalLateDeduction : 0,
          totalEarlyExitMinutes: typeof r.totalEarlyExitMinutes === 'number' && !isNaN(r.totalEarlyExitMinutes) ? r.totalEarlyExitMinutes : 0,
          totalEarlyExitDeduction: typeof r.totalEarlyExitDeduction === 'number' && !isNaN(r.totalEarlyExitDeduction) ? r.totalEarlyExitDeduction : 0,
          totalOtMinutes: typeof r.totalOtMinutes === 'number' && !isNaN(r.totalOtMinutes) ? r.totalOtMinutes : 0,
          totalOtPay: typeof r.totalOtPay === 'number' && !isNaN(r.totalOtPay) ? r.totalOtPay : 0,
          advanceAvailable: typeof r.advanceAvailable === 'number' && !isNaN(r.advanceAvailable) ? r.advanceAvailable : (r.advanceDeduction || 0),
          advanceDeduction: typeof r.advanceDeduction === 'number' && !isNaN(r.advanceDeduction) ? r.advanceDeduction : 0,
          advanceCarriedForward: typeof r.advanceCarriedForward === 'number' && !isNaN(r.advanceCarriedForward) ? r.advanceCarriedForward : 0,
          linkedAdvanceDeductions: r.linkedAdvanceDeductions || [],
          netSalary: typeof r.netSalary === 'number' && !isNaN(r.netSalary) ? r.netSalary : baseSalary,
          paymentStatus: r.paymentStatus || 'APPROVED',
        };
      });
  },
  savePayrollRecords(records: PayrollRecord[]): void {
    saveToStorage(KEYS.PAYROLL, records);
  },

  // --- ADVANCES ---
  getAdvances(): AdvanceTransaction[] {
    return loadFromStorage<AdvanceTransaction[]>(KEYS.ADVANCES, INITIAL_ADVANCES);
  },
  saveAdvance(advance: AdvanceTransaction): void {
    const list = this.getAdvances();
    const idx = list.findIndex(a => a.id === advance.id);
    if (idx >= 0) {
      list[idx] = advance;
    } else {
      list.unshift(advance);
    }
    saveToStorage(KEYS.ADVANCES, list);
    this.addAuditLog({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: advance.createdBy || 'System Admin',
      actionType: 'ADVANCE_CREATED',
      details: `Advance salary of ₹${advance.amount.toLocaleString()} for ${advance.workerName} (${advance.transactionNumber}) saved in local storage.`,
      targetWorkerId: advance.workerId,
      targetWorkerName: advance.workerName,
    });
  },
  voidAdvance(id: string, voidedBy: string, reason: string): void {
    const list = this.getAdvances();
    const adv = list.find(a => a.id === id);
    if (adv) {
      adv.status = 'VOIDED';
      adv.remainingAmount = 0;
      adv.voidReason = reason;
      adv.voidedBy = voidedBy;
      adv.voidedAt = new Date().toISOString();
      saveToStorage(KEYS.ADVANCES, list);
      this.addAuditLog({
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        actorRole: 'ADMIN',
        actorId: 'admin',
        actorName: voidedBy || 'System Admin',
        actionType: 'ADVANCE_VOIDED',
        details: `Advance ${adv.transactionNumber} for ${adv.workerName} was VOIDED. Reason: ${reason}`,
        targetWorkerId: adv.workerId,
        targetWorkerName: adv.workerName,
      });
    }
  },
  getAdvanceDeductions(): AdvancePayrollDeduction[] {
    return loadFromStorage<AdvancePayrollDeduction[]>(KEYS.ADVANCE_DEDUCTIONS, INITIAL_ADVANCE_DEDUCTIONS);
  },

  // --- SESSION ---
  getSession(): CurrentUserSession {
    const fallback: CurrentUserSession = {
      role: 'GUARD',
      id: 'guard-1',
      name: 'Ramesh Kumar',
      username: 'guard01',
      guardCode: 'G-101',
      gate: 'Gate 1 – Main Gate North',
      factory: 'Plant Complex A – Manufacturing Unit',
    };
    return loadFromStorage<CurrentUserSession>(KEYS.SESSION, fallback);
  },
  setSession(session: CurrentUserSession): void {
    saveToStorage(KEYS.SESSION, session);
  },

  // --- RESET ALL TO DEMO DATA ---
  resetAllToDefaults(): void {
    localStorage.removeItem(KEYS.GUARDS);
    localStorage.removeItem(KEYS.RULES);
    localStorage.removeItem(KEYS.WORKERS);
    localStorage.removeItem(KEYS.ATTENDANCE);
    localStorage.removeItem(KEYS.AUDIT);
    localStorage.removeItem(KEYS.PAYROLL);
    localStorage.removeItem(KEYS.ADVANCES);
    localStorage.removeItem(KEYS.ADVANCE_DEDUCTIONS);
  },
};
