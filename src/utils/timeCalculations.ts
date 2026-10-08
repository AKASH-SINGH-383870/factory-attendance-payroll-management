import { WorkingTimeOption, WorkingTimeDetails, AttendanceRulesConfig } from '../types';

export const WORKING_TIME_OPTIONS: WorkingTimeDetails[] = [
  {
    label: '09:00 AM – 05:00 PM',
    startTime24: '09:00',
    endTime24: '17:00',
    startTime12: '09:00 AM',
    endTime12: '05:00 PM',
    normalWorkingMinutes: 480,
    normalWorkingHours: 8,
  },
  {
    label: '09:00 AM – 07:00 PM',
    startTime24: '09:00',
    endTime24: '19:00',
    startTime12: '09:00 AM',
    endTime12: '07:00 PM',
    normalWorkingMinutes: 600,
    normalWorkingHours: 10,
  },
  {
    label: '09:00 AM – 09:00 PM',
    startTime24: '09:00',
    endTime24: '21:00',
    startTime12: '09:00 AM',
    endTime12: '09:00 PM',
    normalWorkingMinutes: 720,
    normalWorkingHours: 12,
  },
];

export function getWorkingTimeDetails(workingTime?: string): WorkingTimeDetails {
  const match = WORKING_TIME_OPTIONS.find(o => o.label === workingTime);
  return match || WORKING_TIME_OPTIONS[1]; // default to 09:00 AM – 07:00 PM
}

/**
 * Format date to readable string: "08 Oct 2026"
 */
export function formatDisplayDate(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format full readable date: "Wednesday, 08 Oct 2026"
 */
export function formatFullDisplayDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Format ISO time or date to 12-hour: "09:12:35 AM"
 */
export function formatTime12(dateOrTimeString?: string | Date): string {
  if (!dateOrTimeString) return '--:--';
  const d = typeof dateOrTimeString === 'string' && !dateOrTimeString.includes(':') 
    ? new Date(dateOrTimeString) 
    : (typeof dateOrTimeString === 'string' ? parseTimeStringToDate(dateOrTimeString) : dateOrTimeString);
  
  if (isNaN(d.getTime())) return typeof dateOrTimeString === 'string' ? dateOrTimeString : '--:--';

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Format to short time: "09:12 AM"
 */
export function formatTime12Short(dateOrTimeString?: string | Date): string {
  if (!dateOrTimeString) return '--:--';
  const d = typeof dateOrTimeString === 'string' && !dateOrTimeString.includes(':') 
    ? new Date(dateOrTimeString) 
    : (typeof dateOrTimeString === 'string' ? parseTimeStringToDate(dateOrTimeString) : dateOrTimeString);
  
  if (isNaN(d.getTime())) return typeof dateOrTimeString === 'string' ? dateOrTimeString : '--:--';

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function parseTimeStringToDate(timeStr: string): Date {
  const d = new Date();
  if (timeStr.includes('T')) {
    const parsed = new Date(timeStr);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  // Try parsing "09:15" or "09:15:20" or "09:15 AM"
  const isPM = /pm/i.test(timeStr);
  const isAM = /am/i.test(timeStr);
  const clean = timeStr.replace(/(am|pm)/i, '').trim();
  const parts = clean.split(':');
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parts[2] ? parseInt(parts[2], 10) : 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    d.setHours(h, m, s, 0);
  }
  return d;
}

/**
 * Calculate late minutes for a worker check-in against assigned working start time (09:00 AM)
 */
export function calculateLateMinutes(
  checkInDate: Date,
  workingTime: string,
  gracePeriodMinutes: number = 0
): number {
  const details = getWorkingTimeDetails(workingTime);
  const [startHours, startMins] = details.startTime24.split(':').map(Number);
  
  const expectedCheckIn = new Date(checkInDate);
  expectedCheckIn.setHours(startHours, startMins, 0, 0);

  const diffMs = checkInDate.getTime() - expectedCheckIn.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes <= 0) return 0;

  if (gracePeriodMinutes > 0 && diffMinutes <= gracePeriodMinutes) {
    return 0; // Excused within grace period
  }

  return diffMinutes;
}

/**
 * Calculate Check-Out Metrics:
 * - Overtime starts ONLY after that worker's assigned normal Working End Time.
 *   (e.g., 05:00 PM, 07:00 PM, or 09:00 PM)
 * - OT Minutes = Actual Check-Out - Assigned End Time (if Actual Check-Out > Assigned End Time)
 * - Early Exit = Assigned End Time - Actual Check-Out (if Actual Check-Out < Assigned End Time)
 */
export function calculateCheckOutMetrics(
  checkInDate: Date,
  checkOutDate: Date,
  workingTime: string
): {
  totalWorkingMinutes: number;
  earlyExitMinutes: number;
  overtimeMinutes: number;
} {
  const details = getWorkingTimeDetails(workingTime);
  const [endHours, endMins] = details.endTime24.split(':').map(Number);

  // Scheduled end time on the day of check-in
  const scheduledEndTime = new Date(checkInDate);
  scheduledEndTime.setHours(endHours, endMins, 0, 0);

  // Total elapsed time between check-in and check-out
  const totalMs = checkOutDate.getTime() - checkInDate.getTime();
  const totalWorkingMinutes = Math.max(0, Math.floor(totalMs / (1000 * 60)));

  let earlyExitMinutes = 0;
  let overtimeMinutes = 0;

  const diffFromEndMs = checkOutDate.getTime() - scheduledEndTime.getTime();
  const diffFromEndMinutes = Math.floor(diffFromEndMs / (1000 * 60));

  if (diffFromEndMinutes > 0) {
    overtimeMinutes = diffFromEndMinutes;
  } else if (diffFromEndMinutes < 0) {
    earlyExitMinutes = Math.abs(diffFromEndMinutes);
  }

  return {
    totalWorkingMinutes,
    earlyExitMinutes,
    overtimeMinutes,
  };
}

/**
 * Format minutes into readable "1 Hour 30 Minutes" or "45 Minutes"
 */
export function formatMinutesToReadable(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 Minutes';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Minutes`;
  if (m === 0) return `${h} ${h === 1 ? 'Hour' : 'Hours'}`;
  return `${h} ${h === 1 ? 'Hour' : 'Hours'} ${m} Minutes`;
}

/**
 * Short duration format: "8h 45m"
 */
export function formatMinutesToDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Currency formatter (INR format)
 */
export function formatCurrency(amount?: number | null, showDecimals: boolean = false): string {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(safeAmount);
}

/**
 * EXACT 30-DAY CRITICAL SALARY ENGINE
 * 
 * Rules:
 * 1. Monthly Salary ALWAYS uses 30 Days.
 *    Per Day Salary = Monthly Salary ÷ 30
 * 2. Per Minute Salary is derived from each worker's assigned normal working time:
 *    - 09:00 AM – 05:00 PM = 480 mins -> Per Minute Salary = Per Day Salary ÷ 480
 *    - 09:00 AM – 07:00 PM = 600 mins -> Per Minute Salary = Per Day Salary ÷ 600
 *    - 09:00 AM – 09:00 PM = 720 mins -> Per Minute Salary = Per Day Salary ÷ 720
 * 3. Absent Deduction = Per Day Salary × Number of Absent Days
 * 4. Late Deduction = Per Minute Salary × Actual Late Minutes
 * 5. Early Exit Deduction = Per Minute Salary × Actual Early Exit Minutes
 * 6. OT Amount = Eligible OT Minutes × (Per Minute Salary × otMultiplier)
 * 7. Final Salary = Monthly Salary - Absent Deduction - Late Deduction - Early Exit Deduction + OT Amount
 * 8. NO DOUBLE DEDUCTIONS!
 */
export function calculateSalaryBreakdown({
  monthlySalary,
  workingTime,
  daysPresent,
  daysAbsent,
  totalLateMinutes,
  totalEarlyExitMinutes = 0,
  totalOtMinutes,
  otRateMultiplier = 1.0,
  advanceDeduction = 0,
}: {
  monthlySalary: number;
  workingTime: WorkingTimeOption;
  daysPresent: number;
  daysAbsent: number;
  totalLateMinutes: number;
  totalEarlyExitMinutes?: number;
  totalOtMinutes: number;
  otRateMultiplier?: number;
  advanceDeduction?: number;
}) {
  const details = getWorkingTimeDetails(workingTime);
  const salaryBasisDays = 30; // STRICT 30 DAYS
  const perDaySalary = monthlySalary / salaryBasisDays;
  const normalWorkingMinutes = details.normalWorkingMinutes; // 480, 600, or 720
  const perMinuteSalary = perDaySalary / normalWorkingMinutes;

  // Deductions
  const absentDeduction = Math.round(daysAbsent * perDaySalary * 100) / 100;
  const lateDeduction = Math.round(totalLateMinutes * perMinuteSalary * 100) / 100;
  const earlyExitDeduction = Math.round(totalEarlyExitMinutes * perMinuteSalary * 100) / 100;

  // Additions (Overtime)
  const otAmount = Math.round(totalOtMinutes * (perMinuteSalary * otRateMultiplier) * 100) / 100;

  // Gross Earnings after attendance penalties
  const grossPayableBeforeAdvance = Math.max(
    0,
    Math.round((monthlySalary - absentDeduction - lateDeduction - earlyExitDeduction + otAmount) * 100) / 100
  );

  // Safe Advance Deduction (Cannot exceed payable salary; remaining balance carried forward)
  const actualAdvanceDeducted = Math.min(advanceDeduction, grossPayableBeforeAdvance);
  const advanceCarriedForward = Math.max(0, Math.round((advanceDeduction - actualAdvanceDeducted) * 100) / 100);

  // Net Payable Salary = Monthly Salary - Absent - Late - EarlyExit + OT - AdvanceDeduction
  const netSalary = Math.max(
    0,
    Math.round((grossPayableBeforeAdvance - actualAdvanceDeducted) * 100) / 100
  );

  return {
    monthlySalary,
    salaryBasisDays,
    perDaySalary,
    normalWorkingMinutes,
    perMinuteSalary,
    daysPresent,
    daysAbsent,
    absentDeduction,
    totalLateMinutes,
    lateDeduction,
    totalEarlyExitMinutes,
    earlyExitDeduction,
    totalOtMinutes,
    otAmount,
    advanceDeduction: actualAdvanceDeducted,
    advanceCarriedForward,
    grossPayableBeforeAdvance,
    netSalary,
  };
}
