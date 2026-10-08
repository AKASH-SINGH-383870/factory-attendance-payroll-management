import fs from 'fs';
import path from 'path';
import {
  GuardUser,
  Worker,
  AttendanceRecord,
  AttendanceRulesConfig,
  SystemAuditLog,
  PayrollRecord,
  ReportSummaryMetrics,
  AdvanceTransaction,
  AdvancePayrollDeduction,
  LinkedAdvanceDeduction,
  AdvanceDashboardStats,
  WorkerAdvanceSummary,
} from '../src/types';
import {
  SEED_GUARDS,
  SEED_WORKERS,
  SEED_ATTENDANCE,
  SEED_RULES,
  SEED_AUDIT_LOGS,
  SEED_ADVANCES,
  SEED_ADVANCE_DEDUCTIONS,
  TODAY,
  CURRENT_MONTH,
} from './seedData';
import {
  calculateSalaryBreakdown,
  calculateLateMinutes,
  calculateCheckOutMetrics,
  getWorkingTimeDetails,
  formatTime12,
} from '../src/utils/timeCalculations';

interface DatabaseSchema {
  guards: GuardUser[];
  workers: Worker[];
  attendance: AttendanceRecord[];
  rules: AttendanceRulesConfig;
  payroll: PayrollRecord[];
  auditLogs: SystemAuditLog[];
  advances: AdvanceTransaction[];
  advanceDeductions: AdvancePayrollDeduction[];
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'factory_database.json');

class DatabaseService {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDataDirectory();
    this.data = this.loadDatabase();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.workers && parsed.guards && parsed.attendance) {
          if (!parsed.advances || !Array.isArray(parsed.advances) || parsed.advances.length === 0) {
            parsed.advances = SEED_ADVANCES;
          }
          if (!parsed.advanceDeductions || !Array.isArray(parsed.advanceDeductions) || parsed.advanceDeductions.length === 0) {
            parsed.advanceDeductions = SEED_ADVANCE_DEDUCTIONS;
          }
          // Ensure seeded payroll reflects advance deductions
          const hasAdvanceInPayroll = parsed.payroll && parsed.payroll.some((p: any) => (p.advanceDeduction || 0) > 0);
          if (!hasAdvanceInPayroll && parsed.payroll) {
            parsed.payroll = this.generateInitialSeedPayroll(
              parsed.workers,
              parsed.attendance,
              parsed.rules || SEED_RULES,
              CURRENT_MONTH,
              parsed.advances,
              parsed.advanceDeductions
            );
            this.saveDatabase(parsed);
          }
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to load existing database file, re-seeding:', err);
    }

    // Initialize with rich seed data
    const initialPayroll = this.generateInitialSeedPayroll(
      SEED_WORKERS,
      SEED_ATTENDANCE,
      SEED_RULES,
      CURRENT_MONTH,
      SEED_ADVANCES,
      SEED_ADVANCE_DEDUCTIONS
    );
    const initialDb: DatabaseSchema = {
      guards: SEED_GUARDS,
      workers: SEED_WORKERS,
      attendance: SEED_ATTENDANCE,
      rules: SEED_RULES,
      payroll: initialPayroll,
      auditLogs: SEED_AUDIT_LOGS,
      advances: SEED_ADVANCES,
      advanceDeductions: SEED_ADVANCE_DEDUCTIONS,
    };

    this.saveDatabase(initialDb);
    return initialDb;
  }

  private saveDatabase(dataToSave: DatabaseSchema = this.data) {
    try {
      this.ensureDataDirectory();
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing to database file:', err);
    }
  }

  private generateInitialSeedPayroll(
    workers: Worker[],
    attendance: AttendanceRecord[],
    rules: AttendanceRulesConfig,
    month: string,
    advances: AdvanceTransaction[] = SEED_ADVANCES,
    advanceDeductions: AdvancePayrollDeduction[] = SEED_ADVANCE_DEDUCTIONS
  ): PayrollRecord[] {
    return workers.map(w => {
      const records = attendance.filter(a => a.workerId === w.id && a.date.startsWith(month));
      let daysAbsent = 0;
      let totalLateMinutes = 0;
      let totalOtMinutes = 0;
      let totalEarlyExitMinutes = 0;

      if (records.length > 0) {
        daysAbsent = records.filter(a => a.status === 'ABSENT').length;
        totalLateMinutes = records.reduce((s, r) => s + (r.lateMinutes || 0), 0);
        totalOtMinutes = records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
        totalEarlyExitMinutes = records.reduce((s, r) => s + (r.earlyExitMinutes || 0), 0);
      }

      // 30 Calendar Days Basis
      const workingDaysInMonth = 30;
      const daysPresent = workingDaysInMonth - daysAbsent;

      // Find deductions specifically seeded for this worker and this month
      const workerDeductions = advanceDeductions.filter(
        d => d.workerId === w.id && d.month === month
      );
      const totalAdvanceDeducted = workerDeductions.reduce((sum, d) => sum + d.deductedAmount, 0);

      // Itemized advance deduction records
      const linkedAdvanceDeductions: LinkedAdvanceDeduction[] = workerDeductions
        .map(d => {
          const tx = advances.find(a => a.id === d.advanceTransactionId);
          return {
            transactionId: d.advanceTransactionId,
            transactionNumber: d.transactionNumber,
            advanceDate: tx?.advanceDate || `${month}-01`,
            paymentMode: tx?.paymentMode || 'Cash',
            amountDeducted: d.deductedAmount,
            totalAdvanceAmount: tx?.amount || d.deductedAmount,
            remarks: tx?.remarks,
          };
        });

      // Total available advance
      const workerAdvances = advances.filter(a => a.workerId === w.id && a.salaryMonth === month && a.status !== 'VOIDED');
      const advanceAvailable = workerAdvances.reduce((sum, a) => sum + a.amount, 0);

      const breakdown = calculateSalaryBreakdown({
        monthlySalary: w.monthlySalary,
        workingTime: w.workingTime,
        daysPresent,
        daysAbsent,
        totalLateMinutes,
        totalEarlyExitMinutes,
        totalOtMinutes,
        otRateMultiplier: rules.otRateMultiplier || 1.0,
        advanceDeduction: totalAdvanceDeducted,
      });

      return {
        id: `pay-${w.id}-${month}`,
        workerId: w.id,
        workerName: w.fullName,
        employeeId: w.employeeId,
        month,
        department: w.department,
        workingTime: w.workingTime,
        baseSalary: w.monthlySalary,
        salaryBasisDays: 30,
        dailyWage: breakdown.perDaySalary,
        normalWorkingMinutesPerDay: breakdown.normalWorkingMinutes,
        perMinuteSalary: breakdown.perMinuteSalary,
        totalDaysInMonth: 30,
        daysPresent: breakdown.daysPresent,
        daysAbsent: breakdown.daysAbsent,
        absentDeduction: breakdown.absentDeduction,
        totalLateMinutes: breakdown.totalLateMinutes,
        totalLateDeduction: breakdown.lateDeduction,
        totalEarlyExitMinutes: breakdown.totalEarlyExitMinutes,
        totalEarlyExitDeduction: breakdown.earlyExitDeduction,
        totalOtMinutes: breakdown.totalOtMinutes,
        totalOtPay: breakdown.otAmount,
        advanceAvailable: advanceAvailable > 0 ? advanceAvailable : totalAdvanceDeducted,
        advanceDeduction: breakdown.advanceDeduction,
        advanceCarriedForward: Math.max(0, advanceAvailable - breakdown.advanceDeduction),
        linkedAdvanceDeductions,
        netSalary: breakdown.netSalary,
        paymentStatus: w.employeeId === 'EMP-002' || w.employeeId === 'EMP-006' ? 'PAID' : 'APPROVED',
        generatedAt: `${TODAY}T08:00:00Z`,
        recordSource: 'seed',
      };
    });
  }

  // ================= WORKERS =================
  getWorkers(): Worker[] {
    return this.data.workers;
  }

  getWorkerById(id: string): Worker | undefined {
    return this.data.workers.find(w => w.id === id);
  }

  createWorker(workerData: Omit<Worker, 'id'> & { id?: string }): Worker {
    const id = workerData.id || `worker-${Date.now()}`;
    const newWorker: Worker = {
      ...workerData,
      id,
      recordSource: 'live',
      documents: workerData.documents || [],
      monthlySalary: Number(workerData.monthlySalary) || 15000,
    };
    this.data.workers.push(newWorker);
    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: 'System Admin',
      actionType: 'WORKER_CREATED',
      details: `New worker profile created: ${newWorker.fullName} (${newWorker.employeeId}). Working Time: ${newWorker.workingTime}. Monthly Salary: ₹${newWorker.monthlySalary}. Source: live.`,
      targetWorkerId: newWorker.id,
      targetWorkerName: newWorker.fullName,
    });

    return newWorker;
  }

  updateWorker(id: string, updates: Partial<Worker>): Worker | null {
    const idx = this.data.workers.findIndex(w => w.id === id);
    if (idx < 0) return null;

    const old = this.data.workers[idx];
    const updated: Worker = {
      ...old,
      ...updates,
      monthlySalary: updates.monthlySalary ? Number(updates.monthlySalary) : old.monthlySalary,
    };
    this.data.workers[idx] = updated;
    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: 'System Admin',
      actionType: 'WORKER_UPDATED',
      details: `Worker ${updated.fullName} (${updated.employeeId}) profile updated by Admin.`,
      targetWorkerId: updated.id,
      targetWorkerName: updated.fullName,
    });

    return updated;
  }

  deleteWorker(id: string): boolean {
    const worker = this.getWorkerById(id);
    if (!worker) return false;

    this.data.workers = this.data.workers.filter(w => w.id !== id);
    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: 'System Admin',
      actionType: 'WORKER_UPDATED',
      details: `Worker ${worker.fullName} (${worker.employeeId}) profile was deleted by Admin.`,
      targetWorkerId: worker.id,
      targetWorkerName: worker.fullName,
    });

    return true;
  }

  // ================= GUARDS =================
  getGuards(): GuardUser[] {
    return this.data.guards;
  }

  createGuard(guardData: Omit<GuardUser, 'id'> & { id?: string }): GuardUser {
    const id = guardData.id || `guard-${Date.now()}`;
    const newGuard: GuardUser = {
      ...guardData,
      id,
      recordSource: 'live',
      status: guardData.status || 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    this.data.guards.push(newGuard);
    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: 'System Admin',
      actionType: 'GUARD_CREATED',
      details: `Guard account created: ${newGuard.fullName} (${newGuard.guardId}) assigned to ${newGuard.gateAssigned}. Source: live.`,
    });

    return newGuard;
  }

  updateGuard(id: string, updates: Partial<GuardUser>): GuardUser | null {
    const idx = this.data.guards.findIndex(g => g.id === id);
    if (idx < 0) return null;

    this.data.guards[idx] = { ...this.data.guards[idx], ...updates };
    this.saveDatabase();
    return this.data.guards[idx];
  }

  toggleGuardStatus(id: string): GuardUser | null {
    const guard = this.data.guards.find(g => g.id === id);
    if (!guard) return null;

    guard.status = guard.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.saveDatabase();
    return guard;
  }

  // ================= ATTENDANCE =================
  getAttendance(filters?: { date?: string; month?: string; workerId?: string; status?: string }): AttendanceRecord[] {
    let list = [...this.data.attendance];
    if (filters?.date) {
      list = list.filter(a => a.date === filters.date);
    }
    if (filters?.month) {
      list = list.filter(a => a.date.startsWith(filters.month!));
    }
    if (filters?.workerId) {
      list = list.filter(a => a.workerId === filters.workerId);
    }
    if (filters?.status) {
      list = list.filter(a => a.status === filters.status);
    }
    return list;
  }

  recordCheckIn(payload: {
    workerId: string;
    photoDataUrl: string;
    guardId: string;
    guardName: string;
    gateName: string;
    timestamp?: string; // Optional override ISO string
  }): AttendanceRecord {
    const worker = this.getWorkerById(payload.workerId);
    if (!worker) {
      throw new Error(`Worker with ID ${payload.workerId} not found.`);
    }

    const now = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = formatTime12(now);

    // Prevent duplicate check-in today
    const existing = this.data.attendance.find(a => a.workerId === worker.id && a.date === dateStr);
    if (existing && existing.checkInTime) {
      throw new Error(`Worker ${worker.fullName} is already checked in today at ${existing.checkInTime}.`);
    }

    const workingDetails = getWorkingTimeDetails(worker.workingTime);
    const lateMins = calculateLateMinutes(now, worker.workingTime);

    const newRecord: AttendanceRecord = {
      id: existing ? existing.id : `att-${Date.now()}`,
      workerId: worker.id,
      workerName: worker.fullName,
      workerEmployeeId: worker.employeeId,
      workerPhoto: worker.profilePhoto,
      date: dateStr,
      workingTime: worker.workingTime,
      workingStartTime: workingDetails.startTime12,
      workingEndTime: workingDetails.endTime12,
      checkInTime: timeStr,
      checkInDateTime: now.toISOString(),
      checkInPhoto: payload.photoDataUrl,
      checkInMarkedByGuardId: payload.guardId,
      checkInMarkedByGuardName: payload.guardName,
      checkInGate: payload.gateName,
      lateMinutes: lateMins,
      totalWorkingMinutes: 0,
      earlyExitMinutes: 0,
      overtimeMinutes: 0,
      status: lateMins > 0 ? 'PRESENT - LATE' : 'PRESENT',
      createdAt: now.toISOString(),
      recordSource: 'live',
    };

    if (existing) {
      const idx = this.data.attendance.findIndex(a => a.id === existing.id);
      this.data.attendance[idx] = newRecord;
    } else {
      this.data.attendance.unshift(newRecord);
    }

    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: now.toISOString(),
      actorRole: 'GUARD',
      actorId: payload.guardId,
      actorName: payload.guardName,
      actionType: 'GUARD_CHECK_IN',
      details: `Security Guard ${payload.guardName} marked Check-In for ${worker.fullName} (${worker.employeeId}) at ${payload.gateName}. Late Minutes: ${lateMins}. Live Photo captured. Source: live.`,
      targetWorkerId: worker.id,
      targetWorkerName: worker.fullName,
    });

    return newRecord;
  }

  recordCheckOut(payload: {
    workerId: string;
    photoDataUrl?: string;
    guardId: string;
    guardName: string;
    gateName: string;
    timestamp?: string;
  }): AttendanceRecord {
    const worker = this.getWorkerById(payload.workerId);
    if (!worker) {
      throw new Error(`Worker with ID ${payload.workerId} not found.`);
    }

    const now = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = formatTime12(now);

    const record = this.data.attendance.find(a => a.workerId === worker.id && a.date === dateStr);
    if (!record || !record.checkInTime) {
      throw new Error(`Worker ${worker.fullName} has not checked in today.`);
    }
    if (record.checkOutTime) {
      throw new Error(`Worker ${worker.fullName} has already checked out today at ${record.checkOutTime}.`);
    }

    const checkInDate = record.checkInDateTime ? new Date(record.checkInDateTime) : now;
    const metrics = calculateCheckOutMetrics(checkInDate, now, worker.workingTime);

    record.checkOutTime = timeStr;
    record.checkOutDateTime = now.toISOString();
    if (payload.photoDataUrl) {
      record.checkOutPhoto = payload.photoDataUrl;
    }
    record.checkOutMarkedByGuardId = payload.guardId;
    record.checkOutMarkedByGuardName = payload.guardName;
    record.checkOutGate = payload.gateName;
    record.totalWorkingMinutes = metrics.totalWorkingMinutes;
    record.earlyExitMinutes = metrics.earlyExitMinutes;
    record.overtimeMinutes = metrics.overtimeMinutes;
    record.status = 'COMPLETED';
    record.updatedAt = now.toISOString();
    record.recordSource = 'live';

    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: now.toISOString(),
      actorRole: 'GUARD',
      actorId: payload.guardId,
      actorName: payload.guardName,
      actionType: 'GUARD_CHECK_OUT',
      details: `Security Guard ${payload.guardName} marked Check-Out for ${worker.fullName} (${worker.employeeId}). Work Mins: ${metrics.totalWorkingMinutes}, OT: ${metrics.overtimeMinutes}m, Early Exit: ${metrics.earlyExitMinutes}m. Source: live.`,
      targetWorkerId: worker.id,
      targetWorkerName: worker.fullName,
    });

    return record;
  }

  adminOverrideAttendance(
    recordId: string,
    updates: Partial<AttendanceRecord>,
    adminName: string,
    reason: string
  ): AttendanceRecord {
    const record = this.data.attendance.find(a => a.id === recordId);
    if (!record) {
      throw new Error(`Attendance record ${recordId} not found.`);
    }

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
    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: adminName,
      actionType: 'ATTENDANCE_OVERRIDE',
      details: `Admin ${adminName} corrected attendance for ${record.workerName} (${record.workerEmployeeId}) on ${record.date}. Reason: ${reason}`,
      targetWorkerId: record.workerId,
      targetWorkerName: record.workerName,
    });

    return record;
  }

  // ================= RULES =================
  getRules(): AttendanceRulesConfig {
    return this.data.rules;
  }

  updateRules(rules: AttendanceRulesConfig): AttendanceRulesConfig {
    this.data.rules = {
      ...rules,
      salaryBasisDays: 30, // ALWAYS 30 DAYS BASIS
    };
    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: 'System Admin',
      actionType: 'RULES_UPDATED',
      details: `Factory attendance policies and overtime rules updated. Basis: 30 days. OT Multiplier: ${this.data.rules.otRateMultiplier}x.`,
    });

    return this.data.rules;
  }

  // ================= PAYROLL =================
  getPayroll(month: string = CURRENT_MONTH): PayrollRecord[] {
    const matching = this.data.payroll.filter(p => p.month === month);
    if (matching.length === 0) {
      // Calculate from live database attendance
      return this.recalculatePayroll(month);
    }
    return matching;
  }

  recalculatePayroll(month: string = CURRENT_MONTH): PayrollRecord[] {
    const workers = this.getWorkers();
    const rules = this.getRules();
    const attendance = this.getAttendance({ month });

    // Step 1: Reconcile and revert any previously applied deductions for this specific month
    // to guarantee idempotency and avoid double deduction.
    const monthDeductions = this.data.advanceDeductions.filter(d => d.month === month);
    for (const ded of monthDeductions) {
      const tx = this.data.advances.find(a => a.id === ded.advanceTransactionId);
      if (tx && tx.status !== 'VOIDED') {
        tx.deductedAmount = Math.max(0, Math.round((tx.deductedAmount - ded.deductedAmount) * 100) / 100);
        tx.remainingAmount = Math.max(0, Math.round((tx.amount - tx.deductedAmount) * 100) / 100);
        tx.status = tx.remainingAmount === 0 ? 'FULLY_DEDUCTED' : (tx.deductedAmount > 0 ? 'PARTIALLY_DEDUCTED' : 'ACTIVE');
      }
    }
    // Remove old deduction records for this month
    this.data.advanceDeductions = this.data.advanceDeductions.filter(d => d.month !== month);

    const calculated: PayrollRecord[] = workers.map(w => {
      const records = attendance.filter(a => a.workerId === w.id);
      const daysAbsent = records.filter(a => a.status === 'ABSENT').length;
      const totalLateMinutes = records.reduce((s, r) => s + (r.lateMinutes || 0), 0);
      const totalOtMinutes = records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
      const totalEarlyExitMinutes = records.reduce((s, r) => s + (r.earlyExitMinutes || 0), 0);

      // STRICT 30-DAY MONTHLY SALARY BASIS
      const workingDaysInMonth = 30;
      const daysPresent = workingDaysInMonth - daysAbsent;

      // Base calculation before advance
      const baseBreakdown = calculateSalaryBreakdown({
        monthlySalary: w.monthlySalary,
        workingTime: w.workingTime,
        daysPresent,
        daysAbsent,
        totalLateMinutes,
        totalEarlyExitMinutes,
        totalOtMinutes,
        otRateMultiplier: rules.otRateMultiplier || 1.0,
        advanceDeduction: 0,
      });

      const grossEarnings = baseBreakdown.grossPayableBeforeAdvance;

      // Fetch outstanding advances for this worker eligible for deduction in this month
      // Sorted FIFO by advanceDate ASC
      const availableAdvances = this.data.advances
        .filter(a => a.workerId === w.id && a.salaryMonth <= month && a.status !== 'VOIDED' && a.remainingAmount > 0)
        .sort((a, b) => a.advanceDate.localeCompare(b.advanceDate));

      const totalAdvanceAvailable = availableAdvances.reduce((sum, a) => sum + a.remainingAmount, 0);

      // Deduct up to gross earnings (cannot exceed; carry forward remaining balance)
      let deductionNeeded = Math.min(totalAdvanceAvailable, grossEarnings);
      let deductionRemaining = deductionNeeded;
      const linkedDeductions: LinkedAdvanceDeduction[] = [];

      for (const adv of availableAdvances) {
        if (deductionRemaining <= 0) break;
        const deductForAdv = Math.min(adv.remainingAmount, deductionRemaining);
        if (deductForAdv > 0) {
          adv.deductedAmount = Math.round((adv.deductedAmount + deductForAdv) * 100) / 100;
          adv.remainingAmount = Math.max(0, Math.round((adv.amount - adv.deductedAmount) * 100) / 100);
          adv.status = adv.remainingAmount === 0 ? 'FULLY_DEDUCTED' : 'PARTIALLY_DEDUCTED';
          adv.updatedAt = new Date().toISOString();

          linkedDeductions.push({
            transactionId: adv.id,
            transactionNumber: adv.transactionNumber,
            advanceDate: adv.advanceDate,
            paymentMode: adv.paymentMode,
            amountDeducted: deductForAdv,
            totalAdvanceAmount: adv.amount,
            remarks: adv.remarks,
          });

          this.data.advanceDeductions.push({
            id: `ded-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            advanceTransactionId: adv.id,
            transactionNumber: adv.transactionNumber,
            payrollId: `pay-${w.id}-${month}`,
            workerId: w.id,
            month,
            deductedAmount: deductForAdv,
            createdAt: new Date().toISOString(),
          });

          deductionRemaining = Math.max(0, Math.round((deductionRemaining - deductForAdv) * 100) / 100);
        }
      }

      const finalBreakdown = calculateSalaryBreakdown({
        monthlySalary: w.monthlySalary,
        workingTime: w.workingTime,
        daysPresent,
        daysAbsent,
        totalLateMinutes,
        totalEarlyExitMinutes,
        totalOtMinutes,
        otRateMultiplier: rules.otRateMultiplier || 1.0,
        advanceDeduction: deductionNeeded,
      });

      // Preserve paid status if already marked paid
      const existingPay = this.data.payroll.find(p => p.workerId === w.id && p.month === month);

      return {
        id: `pay-${w.id}-${month}`,
        workerId: w.id,
        workerName: w.fullName,
        employeeId: w.employeeId,
        month,
        department: w.department,
        workingTime: w.workingTime,
        baseSalary: w.monthlySalary,
        salaryBasisDays: 30,
        dailyWage: finalBreakdown.perDaySalary,
        normalWorkingMinutesPerDay: finalBreakdown.normalWorkingMinutes,
        perMinuteSalary: finalBreakdown.perMinuteSalary,
        totalDaysInMonth: 30,
        daysPresent: finalBreakdown.daysPresent,
        daysAbsent: finalBreakdown.daysAbsent,
        absentDeduction: finalBreakdown.absentDeduction,
        totalLateMinutes: finalBreakdown.totalLateMinutes,
        totalLateDeduction: finalBreakdown.lateDeduction,
        totalEarlyExitMinutes: finalBreakdown.totalEarlyExitMinutes,
        totalEarlyExitDeduction: finalBreakdown.earlyExitDeduction,
        totalOtMinutes: finalBreakdown.totalOtMinutes,
        totalOtPay: finalBreakdown.otAmount,
        advanceAvailable: totalAdvanceAvailable,
        advanceDeduction: finalBreakdown.advanceDeduction,
        advanceCarriedForward: Math.max(0, Math.round((totalAdvanceAvailable - finalBreakdown.advanceDeduction) * 100) / 100),
        linkedAdvanceDeductions: linkedDeductions,
        netSalary: finalBreakdown.netSalary,
        paymentStatus: existingPay?.paymentStatus || 'APPROVED',
        paidAt: existingPay?.paidAt,
        generatedAt: new Date().toISOString(),
        recordSource: w.recordSource || 'live',
      };
    });

    // Update payroll state in database
    this.data.payroll = this.data.payroll.filter(p => p.month !== month).concat(calculated);
    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: 'System Admin',
      actionType: 'PAYROLL_GENERATED',
      details: `Monthly payroll calculated dynamically from database attendance for ${workers.length} workers for ${month}. Total Net: ₹${calculated.reduce((s, r) => s + r.netSalary, 0).toLocaleString()}. Total Advance Deducted: ₹${calculated.reduce((s, r) => s + (r.advanceDeduction || 0), 0).toLocaleString()}`,
    });

    return calculated;
  }

  markPayrollPaid(id: string): PayrollRecord | null {
    const pay = this.data.payroll.find(p => p.id === id);
    if (!pay) return null;

    pay.paymentStatus = 'PAID';
    pay.paidAt = new Date().toISOString();
    this.saveDatabase();
    return pay;
  }

  // ================= ADVANCE SALARY MANAGEMENT =================

  getAdvances(filters?: {
    workerId?: string;
    month?: string;
    status?: string;
    paymentMode?: string;
    search?: string;
  }): AdvanceTransaction[] {
    let list = this.data.advances;

    if (filters?.workerId) {
      list = list.filter(a => a.workerId === filters.workerId);
    }
    if (filters?.month) {
      const targetMonth = filters.month;
      list = list.filter(a => a.salaryMonth === targetMonth || a.advanceDate.startsWith(targetMonth));
    }
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter(a => a.status === filters.status);
    }
    if (filters?.paymentMode && filters.paymentMode !== 'ALL') {
      list = list.filter(a => a.paymentMode === filters.paymentMode);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        a =>
          a.workerName.toLowerCase().includes(q) ||
          a.employeeId.toLowerCase().includes(q) ||
          a.transactionNumber.toLowerCase().includes(q) ||
          (a.paymentReference && a.paymentReference.toLowerCase().includes(q))
      );
    }

    // Sort by advanceDate DESC, then id DESC
    return list.slice().sort((a, b) => b.advanceDate.localeCompare(a.advanceDate));
  }

  getAdvanceById(id: string): AdvanceTransaction | undefined {
    return this.data.advances.find(a => a.id === id);
  }

  createAdvance(payload: {
    workerId: string;
    amount: number;
    advanceDate: string;
    salaryMonth?: string;
    paymentMode: 'Cash' | 'UPI' | 'Bank Transfer';
    paymentReference?: string;
    remarks?: string;
    createdBy?: string;
  }): AdvanceTransaction {
    const worker = this.getWorkerById(payload.workerId);
    if (!worker) {
      throw new Error(`Worker with ID ${payload.workerId} not found.`);
    }

    const amount = Number(payload.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Advance amount must be a valid number greater than zero.');
    }

    // Generate sequential transaction number ADV-XXX
    const count = this.data.advances.length + 1;
    const padded = String(count).padStart(3, '0');
    const transactionNumber = `ADV-${padded}`;

    const date = payload.advanceDate || TODAY;
    const salaryMonth = payload.salaryMonth || date.substring(0, 7);

    const now = new Date().toISOString();
    const newAdvance: AdvanceTransaction = {
      id: `adv-${Date.now()}`,
      transactionNumber,
      workerId: worker.id,
      workerName: worker.fullName,
      employeeId: worker.employeeId,
      amount,
      advanceDate: date,
      salaryMonth,
      paymentMode: payload.paymentMode || 'Cash',
      paymentReference: payload.paymentReference?.trim() || undefined,
      remarks: payload.remarks?.trim() || undefined,
      status: 'ACTIVE',
      deductedAmount: 0,
      remainingAmount: amount,
      recordSource: 'live',
      createdBy: payload.createdBy || 'Factory Superintendent / HR Admin',
      createdAt: now,
      updatedAt: now,
    };

    this.data.advances.unshift(newAdvance);
    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: now,
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: payload.createdBy || 'Factory Superintendent / HR Admin',
      actionType: 'ADVANCE_CREATED',
      details: `Advance salary of ₹${amount.toLocaleString()} granted to ${worker.fullName} (${worker.employeeId}). Transaction: ${transactionNumber}. Mode: ${newAdvance.paymentMode}. Month: ${salaryMonth}.`,
      targetWorkerId: worker.id,
      targetWorkerName: worker.fullName,
      metadata: { transactionNumber, amount, paymentMode: newAdvance.paymentMode },
    });

    return newAdvance;
  }

  updateAdvance(
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
  ): AdvanceTransaction {
    const adv = this.getAdvanceById(id);
    if (!adv) {
      throw new Error(`Advance transaction ${id} not found.`);
    }

    if (adv.status === 'VOIDED') {
      throw new Error('Cannot edit a voided advance transaction.');
    }

    if (adv.deductedAmount > 0 && updates.amount !== undefined) {
      const newAmount = Number(updates.amount);
      if (newAmount < adv.deductedAmount) {
        throw new Error(`Cannot reduce advance amount below already deducted amount (₹${adv.deductedAmount}).`);
      }
      adv.amount = newAmount;
      adv.remainingAmount = Math.max(0, Math.round((newAmount - adv.deductedAmount) * 100) / 100);
      adv.status = adv.remainingAmount === 0 ? 'FULLY_DEDUCTED' : 'PARTIALLY_DEDUCTED';
    } else if (updates.amount !== undefined) {
      const newAmount = Number(updates.amount);
      if (newAmount <= 0) {
        throw new Error('Advance amount must be greater than zero.');
      }
      adv.amount = newAmount;
      adv.remainingAmount = newAmount;
    }

    if (updates.advanceDate) adv.advanceDate = updates.advanceDate;
    if (updates.salaryMonth) adv.salaryMonth = updates.salaryMonth;
    if (updates.paymentMode) adv.paymentMode = updates.paymentMode;
    if (updates.paymentReference !== undefined) adv.paymentReference = updates.paymentReference;
    if (updates.remarks !== undefined) adv.remarks = updates.remarks;
    adv.updatedAt = new Date().toISOString();

    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: updates.updatedBy || 'Factory Superintendent / HR Admin',
      actionType: 'ADVANCE_UPDATED',
      details: `Advance transaction ${adv.transactionNumber} for ${adv.workerName} updated. Amount: ₹${adv.amount}. Mode: ${adv.paymentMode}.`,
      targetWorkerId: adv.workerId,
      targetWorkerName: adv.workerName,
    });

    return adv;
  }

  voidAdvance(id: string, voidedBy: string, reason: string): AdvanceTransaction {
    const adv = this.getAdvanceById(id);
    if (!adv) {
      throw new Error(`Advance transaction ${id} not found.`);
    }

    if (adv.status === 'VOIDED') {
      throw new Error('This advance transaction is already voided.');
    }

    if (adv.deductedAmount > 0) {
      throw new Error(
        `Cannot void advance ${adv.transactionNumber} because ₹${adv.deductedAmount} has already been deducted in payroll. Reconcile or cancel payroll first.`
      );
    }

    const now = new Date().toISOString();
    adv.status = 'VOIDED';
    adv.remainingAmount = 0;
    adv.voidReason = reason || 'Cancelled by Admin';
    adv.voidedAt = now;
    adv.voidedBy = voidedBy || 'Admin';
    adv.updatedAt = now;

    this.saveDatabase();

    this.addAuditLog({
      id: `log-${Date.now()}`,
      timestamp: now,
      actorRole: 'ADMIN',
      actorId: 'admin',
      actorName: voidedBy || 'Factory Superintendent / HR Admin',
      actionType: 'ADVANCE_VOIDED',
      details: `Advance transaction ${adv.transactionNumber} (₹${adv.amount}) for ${adv.workerName} was VOIDED. Reason: ${adv.voidReason}.`,
      targetWorkerId: adv.workerId,
      targetWorkerName: adv.workerName,
    });

    return adv;
  }

  getAdvanceStats(month: string = CURRENT_MONTH): AdvanceDashboardStats {
    const monthAdvances = this.data.advances.filter(
      a => (a.salaryMonth === month || a.advanceDate.startsWith(month)) && a.status !== 'VOIDED'
    );

    const totalAdvancePaidMonth = monthAdvances.reduce((sum, a) => sum + a.amount, 0);
    const workerIds = new Set(monthAdvances.map(a => a.workerId));
    const totalWorkersWithAdvance = workerIds.size;
    const totalAdvanceTransactions = monthAdvances.length;

    // Outstanding balance across all active / partially deducted advances in system
    const outstandingAdvanceBalance = this.data.advances
      .filter(a => a.status !== 'VOIDED')
      .reduce((sum, a) => sum + (a.remainingAmount || 0), 0);

    // This month's actual deductions recorded
    const monthAdvanceDeductions = this.data.advanceDeductions
      .filter(d => d.month === month)
      .reduce((sum, d) => sum + d.deductedAmount, 0);

    const recentTransactions = this.data.advances
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);

    return {
      month,
      totalAdvancePaidMonth,
      totalWorkersWithAdvance,
      totalAdvanceTransactions,
      outstandingAdvanceBalance,
      monthAdvanceDeductions,
      recentTransactions,
    };
  }

  getWorkerAdvanceSummary(workerId: string): WorkerAdvanceSummary {
    const worker = this.getWorkerById(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found.`);
    }

    const transactions = this.data.advances
      .filter(a => a.workerId === workerId)
      .sort((a, b) => b.advanceDate.localeCompare(a.advanceDate));

    const deductions = this.data.advanceDeductions
      .filter(d => d.workerId === workerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const validTx = transactions.filter(a => a.status !== 'VOIDED');
    const totalAdvanceReceived = validTx.reduce((sum, a) => sum + a.amount, 0);
    const currentMonthAdvance = validTx
      .filter(a => a.salaryMonth === CURRENT_MONTH || a.advanceDate.startsWith(CURRENT_MONTH))
      .reduce((sum, a) => sum + a.amount, 0);
    const totalAdvanceDeducted = deductions.reduce((sum, d) => sum + d.deductedAmount, 0);
    const outstandingBalance = validTx.reduce((sum, a) => sum + (a.remainingAmount || 0), 0);

    return {
      workerId: worker.id,
      workerName: worker.fullName,
      employeeId: worker.employeeId,
      profilePhoto: worker.profilePhoto,
      department: worker.department,
      monthlySalary: worker.monthlySalary,
      totalAdvanceReceived,
      currentMonthAdvance,
      totalAdvanceDeducted,
      outstandingBalance,
      transactions,
      deductions,
    };
  }

  // ================= REPORTS =================
  getReports(month: string = CURRENT_MONTH) {
    const workers = this.getWorkers();
    const attendance = this.getAttendance({ month });
    const payroll = this.getPayroll(month);

    // 1. Late Attendance Records
    const lateRecords = attendance
      .filter(a => (a.lateMinutes || 0) > 0)
      .map(a => {
        const worker = workers.find(w => w.id === a.workerId);
        const dailyWage = (worker?.monthlySalary || 15000) / 30;
        const normalMins = getWorkingTimeDetails(worker?.workingTime).normalWorkingMinutes;
        const perMin = dailyWage / normalMins;
        const deduction = Math.round(a.lateMinutes * perMin * 100) / 100;
        return {
          id: a.id,
          date: a.date,
          workerId: a.workerId,
          workerName: a.workerName,
          employeeId: a.workerEmployeeId,
          department: worker?.department || 'Production',
          workingTime: a.workingTime,
          checkInTime: a.checkInTime,
          lateMinutes: a.lateMinutes,
          deductionAmount: deduction,
          guardName: a.checkInMarkedByGuardName,
          gate: a.checkInGate,
          recordSource: a.recordSource || 'seed',
        };
      });

    // 2. Absenteeism Records
    const absentRecords = attendance
      .filter(a => a.status === 'ABSENT')
      .map(a => {
        const worker = workers.find(w => w.id === a.workerId);
        const perDay = Math.round(((worker?.monthlySalary || 15000) / 30) * 100) / 100;
        return {
          id: a.id,
          date: a.date,
          workerId: a.workerId,
          workerName: a.workerName,
          employeeId: a.workerEmployeeId,
          department: worker?.department || 'Production',
          workingTime: a.workingTime,
          deductionAmount: perDay,
          guardName: a.checkInMarkedByGuardName || 'System',
          recordSource: a.recordSource || 'seed',
        };
      });

    // 3. Overtime (OT) Records
    const otRecords = attendance
      .filter(a => (a.overtimeMinutes || 0) > 0)
      .map(a => {
        const worker = workers.find(w => w.id === a.workerId);
        const dailyWage = (worker?.monthlySalary || 15000) / 30;
        const normalMins = getWorkingTimeDetails(worker?.workingTime).normalWorkingMinutes;
        const perMin = dailyWage / normalMins;
        const otPay = Math.round(a.overtimeMinutes * (perMin * (this.data.rules.otRateMultiplier || 1.0)) * 100) / 100;
        return {
          id: a.id,
          date: a.date,
          workerId: a.workerId,
          workerName: a.workerName,
          employeeId: a.workerEmployeeId,
          department: worker?.department || 'Production',
          workingTime: a.workingTime,
          checkOutTime: a.checkOutTime,
          workingEndTime: a.workingEndTime,
          overtimeMinutes: a.overtimeMinutes,
          otPayAmount: otPay,
          guardName: a.checkOutMarkedByGuardName || a.checkInMarkedByGuardName,
          gate: a.checkOutGate || a.checkInGate,
          recordSource: a.recordSource || 'seed',
        };
      });

    // 4. Aggregate Monthly Metrics
    const summary: ReportSummaryMetrics = {
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
      totalAdvanceDeductions: Math.round(payroll.reduce((s, p) => s + (p.advanceDeduction || 0), 0) * 100) / 100,
      totalWageLiability: Math.round(payroll.reduce((s, p) => s + (p.netSalary || 0), 0) * 100) / 100,
    };

    return {
      month,
      summary,
      lateRecords,
      absentRecords,
      otRecords,
      workerMonthlyMatrix: payroll,
    };
  }

  // ================= DASHBOARD STATS =================
  getDashboardStats(dateStr: string = TODAY, monthStr: string = CURRENT_MONTH) {
    const workers = this.getWorkers();
    const guards = this.getGuards();
    const todayAttendance = this.getAttendance({ date: dateStr });
    const monthAttendance = this.getAttendance({ month: monthStr });

    const totalWorkers = workers.length;
    const insideFactory = todayAttendance.filter(a => a.checkInTime && !a.checkOutTime).length;
    const checkedInToday = todayAttendance.filter(a => Boolean(a.checkInTime)).length;
    const lateToday = todayAttendance.filter(a => (a.lateMinutes || 0) > 0).length;
    const completedToday = todayAttendance.filter(a => Boolean(a.checkOutTime)).length;
    const absentToday = todayAttendance.filter(a => a.status === 'ABSENT').length;
    const activeGuards = guards.filter(g => g.status === 'ACTIVE').length;

    const totalWageLiability = workers.reduce((s, w) => s + (w.monthlySalary || 0), 0);

    return {
      date: dateStr,
      month: monthStr,
      totalWorkers,
      insideFactory,
      checkedInToday,
      lateToday,
      completedToday,
      absentToday,
      activeGuards,
      totalWageLiability,
      todayRoll: todayAttendance.slice(0, 10),
      recentAuditLogs: this.data.auditLogs.slice(0, 8),
    };
  }

  // ================= AUDIT LOGS =================
  getAuditLogs(): SystemAuditLog[] {
    return this.data.auditLogs;
  }

  addAuditLog(log: SystemAuditLog) {
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.saveDatabase();
  }

  // ================= RESET =================
  resetToDefaults(): void {
    const initialPayroll = this.generateInitialSeedPayroll(
      SEED_WORKERS,
      SEED_ATTENDANCE,
      SEED_RULES,
      CURRENT_MONTH,
      SEED_ADVANCES,
      SEED_ADVANCE_DEDUCTIONS
    );
    this.data = {
      guards: SEED_GUARDS,
      workers: SEED_WORKERS,
      attendance: SEED_ATTENDANCE,
      rules: SEED_RULES,
      payroll: initialPayroll,
      auditLogs: SEED_AUDIT_LOGS,
      advances: SEED_ADVANCES,
      advanceDeductions: SEED_ADVANCE_DEDUCTIONS,
    };
    this.saveDatabase();
  }
}

export const db = new DatabaseService();
