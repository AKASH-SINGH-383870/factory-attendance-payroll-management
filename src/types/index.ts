export type Role = 'ADMIN' | 'GUARD';
export type RecordSource = 'seed' | 'live';

export type WorkingTimeOption =
  | '09:00 AM – 05:00 PM'
  | '09:00 AM – 07:00 PM'
  | '09:00 AM – 09:00 PM';

export interface WorkingTimeDetails {
  label: WorkingTimeOption;
  startTime24: string; // '09:00'
  endTime24: string;   // '17:00' | '19:00' | '21:00'
  startTime12: string; // '09:00 AM'
  endTime12: string;   // '05:00 PM' | '07:00 PM' | '09:00 PM'
  normalWorkingMinutes: number; // 480, 600, 720
  normalWorkingHours: number;   // 8, 10, 12
}

export interface GuardUser {
  id: string;
  guardId: string; // e.g. G-101
  fullName: string;
  mobile: string;
  username: string;
  passwordHash: string;
  gateAssigned: string; // e.g. "Gate 1 – Main Gate North"
  factoryLocation: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  lastLogin?: string;
  recordSource?: RecordSource;
}

export interface WorkerDocument {
  id: string;
  name: string;
  type: 'Aadhaar / ID Card' | 'PAN Card' | 'Employment Contract' | 'Medical Fitness' | 'Bank Passbook' | 'Other';
  fileUrl: string;
  uploadedAt: string;
}

export interface Worker {
  id: string;
  employeeId: string; // e.g. EMP-001
  fullName: string;
  mobileNumber: string;
  emergencyContact: string;
  address?: string;
  profilePhoto: string; // base64 or URL
  department: string; // e.g. "Cutting & Tailoring", "Machine Shop", "Assembly Line"
  designation: string; // e.g. "Senior Tailor", "CNC Operator", "Packaging Supervisor"
  workingTime: WorkingTimeOption; // 09:00 AM – 05:00 PM, 09:00 AM – 07:00 PM, 09:00 AM – 09:00 PM
  monthlySalary: number; // e.g. 15000
  bankAccountNumber?: string;
  bankIfsc?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  dateOfJoining: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  documents: WorkerDocument[];
  recordSource?: RecordSource;
}

export interface AttendanceRecord {
  id: string;
  workerId: string;
  workerName: string;
  workerEmployeeId: string;
  workerPhoto: string;
  date: string; // YYYY-MM-DD
  workingTime: WorkingTimeOption;
  workingStartTime: string; // "09:00 AM"
  workingEndTime: string;   // "05:00 PM" | "07:00 PM" | "09:00 PM"
  
  // Check-In Details
  checkInTime?: string; // "09:12:35 AM"
  checkInDateTime?: string;
  checkInPhoto?: string; // Captured live photo data URL with stamped timestamp & worker info
  checkInMarkedByGuardId: string;
  checkInMarkedByGuardName: string;
  checkInGate: string;
  lateMinutes: number;
  
  // Check-Out Details
  checkOutTime?: string; // "08:00:00 PM"
  checkOutDateTime?: string;
  checkOutPhoto?: string; // Captured live photo data URL with stamped timestamp & worker info
  checkOutMarkedByGuardId?: string;
  checkOutMarkedByGuardName?: string;
  checkOutGate?: string;
  
  // Calculations
  totalWorkingMinutes: number;
  earlyExitMinutes: number;
  overtimeMinutes: number;
  
  // Status: Present, Present - Late, Present + OT, Completed, Absent
  status: 'PRESENT' | 'PRESENT - LATE' | 'PRESENT + OT' | 'COMPLETED' | 'ABSENT' | 'NOT_ARRIVED';
  
  // Audit info
  createdAt: string;
  updatedAt?: string;
  isManuallyModified?: boolean;
  modificationHistory?: AttendanceModificationEntry[];
  recordSource?: RecordSource;
}

export interface AttendanceModificationEntry {
  modifiedAt: string;
  modifiedByAdminName: string;
  reason: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
}

export interface AttendanceRulesConfig {
  salaryBasisDays: 30; // ALWAYS 30 DAYS
  gracePeriodMinutes: number; // e.g. 0 or 15 mins
  otRateMultiplier: number; // e.g. 1.0 or 1.5
  requireCheckOutPhoto: boolean;
}

export interface PayrollRecord {
  id: string;
  workerId: string;
  workerName: string;
  employeeId: string;
  month: string; // "2026-10"
  department: string;
  workingTime: WorkingTimeOption;
  baseSalary: number; // Monthly salary
  salaryBasisDays: 30; // 30 Days default
  dailyWage: number; // baseSalary / 30
  normalWorkingMinutesPerDay: number; // 480, 600, 720
  perMinuteSalary: number; // dailyWage / normalWorkingMinutesPerDay
  
  totalDaysInMonth: number; // 30
  daysPresent: number;
  daysAbsent: number;
  absentDeduction: number; // daysAbsent * dailyWage
  
  totalLateMinutes: number;
  totalLateDeduction: number; // totalLateMinutes * perMinuteSalary
  
  totalEarlyExitMinutes: number;
  totalEarlyExitDeduction: number; // totalEarlyExitMinutes * perMinuteSalary
  
  totalOtMinutes: number;
  totalOtPay: number; // totalOtMinutes * (perMinuteSalary * otRateMultiplier)

  // Advance Salary Integration
  advanceAvailable?: number; // Total outstanding advance balance before payroll
  advanceDeduction?: number; // Actual advance amount deducted this month
  advanceCarriedForward?: number; // Remaining advance balance carried forward if advance > salary
  linkedAdvanceDeductions?: LinkedAdvanceDeduction[]; // Itemized advances deducted

  netSalary: number; // baseSalary - absentDeduction - totalLateDeduction - totalEarlyExitDeduction + totalOtPay - advanceDeduction
  paymentStatus: 'DRAFT' | 'APPROVED' | 'PAID';
  generatedAt: string;
  paidAt?: string;
  remarks?: string;
  recordSource?: RecordSource;
}

export type AdvancePaymentMode = 'Cash' | 'UPI' | 'Bank Transfer';
export type AdvanceStatus = 'ACTIVE' | 'PARTIALLY_DEDUCTED' | 'FULLY_DEDUCTED' | 'VOIDED';

export interface LinkedAdvanceDeduction {
  transactionId: string;
  transactionNumber: string;
  advanceDate: string;
  paymentMode: AdvancePaymentMode;
  amountDeducted: number;
  totalAdvanceAmount: number;
  remarks?: string;
}

export interface AdvanceTransaction {
  id: string;
  transactionNumber: string; // e.g. "ADV-001"
  workerId: string;
  workerName: string;
  employeeId: string;
  amount: number;
  advanceDate: string; // YYYY-MM-DD
  salaryMonth: string; // YYYY-MM
  paymentMode: AdvancePaymentMode;
  paymentReference?: string;
  remarks?: string;
  status: AdvanceStatus;
  deductedAmount: number; // Amount deducted so far across payrolls
  remainingAmount: number; // amount - deductedAmount
  recordSource?: RecordSource;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
}

export interface AdvancePayrollDeduction {
  id: string;
  advanceTransactionId: string;
  transactionNumber: string;
  payrollId: string;
  workerId: string;
  month: string; // YYYY-MM
  deductedAmount: number;
  createdAt: string;
}

export interface AdvanceDashboardStats {
  month: string;
  totalAdvancePaidMonth: number;
  totalWorkersWithAdvance: number;
  totalAdvanceTransactions: number;
  outstandingAdvanceBalance: number;
  monthAdvanceDeductions: number;
  recentTransactions: AdvanceTransaction[];
}

export interface WorkerAdvanceSummary {
  workerId: string;
  workerName: string;
  employeeId: string;
  profilePhoto: string;
  department: string;
  monthlySalary: number;
  totalAdvanceReceived: number;
  currentMonthAdvance: number;
  totalAdvanceDeducted: number;
  outstandingBalance: number;
  transactions: AdvanceTransaction[];
  deductions: AdvancePayrollDeduction[];
}

export interface ReportSummaryMetrics {
  month: string;
  totalWorkers: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalLateMinutes: number;
  totalLateDeductions: number;
  totalOtMinutes: number;
  totalOtPaid: number;
  totalEarlyExitMinutes: number;
  totalEarlyExitDeductions: number;
  totalAdvanceDeductions?: number;
  totalWageLiability: number;
}

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  actorRole: Role;
  actorId: string;
  actorName: string;
  actionType:
    | 'GUARD_CHECK_IN'
    | 'GUARD_CHECK_OUT'
    | 'WORKER_CREATED'
    | 'WORKER_UPDATED'
    | 'GUARD_CREATED'
    | 'RULES_UPDATED'
    | 'ATTENDANCE_OVERRIDE'
    | 'PAYROLL_GENERATED'
    | 'ADVANCE_CREATED'
    | 'ADVANCE_UPDATED'
    | 'ADVANCE_VOIDED'
    | 'PAYROLL_DEDUCTION_APPLIED'
    | 'PAYROLL_DEDUCTION_REVERSED'
    | 'ADVANCE_CARRIED_FORWARD';
  details: string;
  targetWorkerId?: string;
  targetWorkerName?: string;
  metadata?: Record<string, any>;
}

export interface CurrentUserSession {
  role: Role;
  id: string;
  name: string;
  username: string;
  guardCode?: string;
  gate?: string;
  factory?: string;
}
