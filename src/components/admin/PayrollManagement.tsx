import React, { useState, useMemo } from 'react';
import {
  Coins,
  Calculator,
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  CreditCard,
  Building,
  User,
  Calendar,
  Clock,
} from 'lucide-react';
import { Worker, PayrollRecord, AttendanceRulesConfig, AttendanceRecord } from '../../types';
import { StorageService } from '../../services/storage';
import { ApiService } from '../../services/api';
import {
  formatCurrency,
  formatMinutesToReadable,
  formatMinutesToDuration,
  calculateSalaryBreakdown,
  getWorkingTimeDetails,
} from '../../utils/timeCalculations';

interface PayrollManagementProps {
  workers: Worker[];
  rules: AttendanceRulesConfig;
  adminName: string;
}

export const PayrollManagementView: React.FC<PayrollManagementProps> = ({
  workers,
  rules,
  adminName,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(StorageService.getPayrollRecords());
  const [viewingSlip, setViewingSlip] = useState<PayrollRecord | null>(null);

  const loadPayroll = async () => {
    try {
      const records = await ApiService.getPayroll(selectedMonth);
      setPayrollRecords(records);
    } catch {
      setPayrollRecords(StorageService.getPayrollRecords());
    }
  };

  React.useEffect(() => {
    loadPayroll();
  }, [selectedMonth]);

  // Generate or recalculate monthly salary for all workers using strict 30-day formula
  const handleGeneratePayroll = async () => {
    try {
      const recalculated = await ApiService.recalculatePayroll(selectedMonth);
      setPayrollRecords(recalculated);
    } catch {
      const attendanceAll = StorageService.getAttendance();
      const allAdvances = StorageService.getAdvances();
      
      const generated: PayrollRecord[] = workers.map(w => {
        const workerRecords = attendanceAll.filter(
          a => a.workerId === w.id && a.date.startsWith(selectedMonth)
        );
        const daysAbsent = workerRecords.filter(a => a.status === 'ABSENT').length;
        const totalLateMins = workerRecords.reduce((acc, r) => acc + (r.lateMinutes || 0), 0);
        const totalOtMins = workerRecords.reduce((acc, r) => acc + (r.overtimeMinutes || 0), 0);
        const totalEarlyExitMins = workerRecords.reduce((acc, r) => acc + (r.earlyExitMinutes || 0), 0);
        const daysPresent = 30 - daysAbsent;

        // Base breakdown before advance
        const baseBreakdown = calculateSalaryBreakdown({
          monthlySalary: w.monthlySalary,
          workingTime: w.workingTime,
          daysPresent,
          daysAbsent,
          totalLateMinutes: totalLateMins,
          totalEarlyExitMinutes: totalEarlyExitMins,
          totalOtMinutes: totalOtMins,
          otRateMultiplier: rules.otRateMultiplier || 1.0,
          advanceDeduction: 0,
        });

        const grossEarnings = baseBreakdown.grossPayableBeforeAdvance;

        // Active advances for worker
        const workerAdvances = allAdvances
          .filter(a => a.workerId === w.id && a.salaryMonth <= selectedMonth && a.status !== 'VOIDED' && a.remainingAmount > 0)
          .sort((a, b) => a.advanceDate.localeCompare(b.advanceDate));

        const totalAdvanceAvailable = workerAdvances.reduce((sum, a) => sum + a.remainingAmount, 0);
        const advanceDeductNeeded = Math.min(totalAdvanceAvailable, grossEarnings);

        const breakdown = calculateSalaryBreakdown({
          monthlySalary: w.monthlySalary,
          workingTime: w.workingTime,
          daysPresent,
          daysAbsent,
          totalLateMinutes: totalLateMins,
          totalEarlyExitMinutes: totalEarlyExitMins,
          totalOtMinutes: totalOtMins,
          otRateMultiplier: rules.otRateMultiplier || 1.0,
          advanceDeduction: advanceDeductNeeded,
        });

        const linkedDeductions = workerAdvances.map(a => ({
          transactionId: a.id,
          transactionNumber: a.transactionNumber,
          advanceDate: a.advanceDate,
          paymentMode: a.paymentMode,
          amountDeducted: Math.min(a.remainingAmount, advanceDeductNeeded),
          totalAdvanceAmount: a.amount,
          remarks: a.remarks,
        })).filter(l => l.amountDeducted > 0);

        return {
          id: `pay-${w.id}-${selectedMonth}`,
          workerId: w.id,
          workerName: w.fullName,
          employeeId: w.employeeId,
          month: selectedMonth,
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
          advanceAvailable: totalAdvanceAvailable,
          advanceDeduction: breakdown.advanceDeduction,
          advanceCarriedForward: Math.max(0, Math.round((totalAdvanceAvailable - breakdown.advanceDeduction) * 100) / 100),
          linkedAdvanceDeductions: linkedDeductions,
          netSalary: breakdown.netSalary,
          paymentStatus: 'APPROVED',
          generatedAt: new Date().toISOString(),
          recordSource: 'live',
        };
      });

      setPayrollRecords(generated);
      StorageService.savePayrollRecords(generated);
    }
  };

  const handleMarkAsPaid = async (recordId: string) => {
    try {
      await ApiService.markPayrollPaid(recordId);
    } catch {
      // Fallback
    }
    const updated = payrollRecords.map(r => {
      if (r.id === recordId) {
        return {
          ...r,
          paymentStatus: 'PAID' as const,
          paidAt: new Date().toISOString(),
        };
      }
      return r;
    });
    setPayrollRecords(updated);
    StorageService.savePayrollRecords(updated);
  };

  // Summaries
  const totals = useMemo(() => {
    const totalNet = payrollRecords.reduce((acc, r) => acc + (r.netSalary || 0), 0);
    const totalOt = payrollRecords.reduce((acc, r) => acc + (r.totalOtPay || 0), 0);
    const totalAbsentDeduction = payrollRecords.reduce((acc, r) => acc + (r.absentDeduction || 0), 0);
    const totalLateDeduction = payrollRecords.reduce((acc, r) => acc + (r.totalLateDeduction || 0), 0);
    const totalAdvanceDeduction = payrollRecords.reduce((acc, r) => acc + (r.advanceDeduction || 0), 0);
    return { totalNet, totalOt, totalAbsentDeduction, totalLateDeduction, totalAdvanceDeduction };
  }, [payrollRecords]);

  // Export CSV
  const handleExportPayrollCSV = () => {
    if (payrollRecords.length === 0) return;
    const headers = [
      'Emp ID',
      'Worker Name',
      'Working Time',
      'Monthly Salary',
      'Salary Basis',
      'Per Day Salary',
      'Days Present',
      'Days Absent',
      'Absent Deduction',
      'Late Minutes',
      'Late Deduction',
      'OT Minutes',
      'OT Pay',
      'Advance Deducted',
      'Advance Carried Forward',
      'Net Salary',
      'Payment Status',
    ];
    const rows = payrollRecords.map(r => [
      r.employeeId || '',
      `"${r.workerName || ''}"`,
      `"${r.workingTime || '09:00 AM – 07:00 PM'}"`,
      r.baseSalary || 0,
      '30 Days',
      Number(r.dailyWage != null ? r.dailyWage : ((r.baseSalary || 15000) / 30)).toFixed(2),
      r.daysPresent ?? 30,
      r.daysAbsent ?? 0,
      Number(r.absentDeduction != null ? r.absentDeduction : 0).toFixed(2),
      r.totalLateMinutes ?? 0,
      Number(r.totalLateDeduction != null ? r.totalLateDeduction : 0).toFixed(2),
      r.totalOtMinutes ?? 0,
      Number(r.totalOtPay != null ? r.totalOtPay : 0).toFixed(2),
      Number(r.advanceDeduction != null ? r.advanceDeduction : 0).toFixed(2),
      Number(r.advanceCarriedForward != null ? r.advanceCarriedForward : 0).toFixed(2),
      Number(r.netSalary != null ? r.netSalary : (r.baseSalary || 0)).toFixed(2),
      r.paymentStatus || 'APPROVED',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `factory_payroll_30days_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Monthly Salary & Slips (30-Day Basis)</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Strict 30-day salary calculation: Per Day = Monthly Salary ÷ 30. Per-minute late deductions & overtime additions per worker working time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-slate-400">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-xs font-mono outline-none"
            />
          </div>

          <button
            onClick={handleGeneratePayroll}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
          >
            <Calculator className="w-4 h-4" />
            <span>Recalculate Monthly Salary</span>
          </button>

          {payrollRecords.length > 0 && (
            <button
              onClick={handleExportPayrollCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export Bank Sheet</span>
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Metrics Bar (30-day basis) */}
      {payrollRecords.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Net Salary Liability
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
              {formatCurrency(totals.totalNet, true)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">30-day monthly formula</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">
              Total Absent Deductions
            </span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
              {formatCurrency(totals.totalAbsentDeduction, true)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">₹(Monthly ÷ 30) per day</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
              Total Late Deductions
            </span>
            <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">
              {formatCurrency(totals.totalLateDeduction, true)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Per-minute exact salary cut</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider block">
              Total Overtime (OT) Pay
            </span>
            <span className="text-2xl font-black text-sky-400 font-mono mt-1 block">
              {formatCurrency(totals.totalOt, true)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Only after assigned end time</span>
          </div>

          <div className="bg-slate-900 border border-amber-900/40 p-4 rounded-xl bg-gradient-to-br from-slate-900 to-amber-950/20">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
              Total Advance Deductions
            </span>
            <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">
              {formatCurrency(totals.totalAdvanceDeduction, true)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Recovered through payroll</span>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Worker & Working Time</th>
                <th className="py-3 px-4">Monthly Salary (30d)</th>
                <th className="py-3 px-4">Attendance (Present/Absent)</th>
                <th className="py-3 px-4">Absent Cut (1d = ₹XX)</th>
                <th className="py-3 px-4">Late Cut (Per-Min)</th>
                <th className="py-3 px-4">OT Pay (Added)</th>
                <th className="py-3 px-4 text-amber-400">Advance Cut</th>
                <th className="py-3 px-4">Net Payable Salary</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Salary Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {payrollRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 text-sm">
                    No payroll calculations for {selectedMonth}. Click "Recalculate Monthly Salary" above to generate.
                  </td>
                </tr>
              ) : (
                payrollRecords.map(pay => (
                  <tr key={pay.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white leading-tight">{pay.workerName}</div>
                      <div className="text-xs font-mono text-slate-400">{pay.employeeId} • {pay.department}</div>
                      <span className="text-[11px] font-mono text-emerald-400 block mt-0.5">{pay.workingTime}</span>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                      <div>{formatCurrency(pay.baseSalary || 0)}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        ₹{Number(pay.dailyWage != null ? pay.dailyWage : ((pay.baseSalary || 15000) / 30)).toFixed(0)}/day (30d)
                      </div>
                    </td>

                    <td className="py-3 px-4 text-xs font-mono">
                      <div><strong className="text-emerald-400">{pay.daysPresent ?? 30}</strong> Present / 30 Days</div>
                      {(pay.daysAbsent || 0) > 0 && <div className="text-rose-400">{pay.daysAbsent} Days Absent</div>}
                    </td>

                    {/* Absent Deduction */}
                    <td className="py-3 px-4 font-mono text-xs">
                      {(pay.absentDeduction || 0) > 0 ? (
                        <span className="text-rose-400 font-bold">
                          -{formatCurrency(pay.absentDeduction, true)}
                        </span>
                      ) : (
                        <span className="text-slate-500">₹0</span>
                      )}
                    </td>

                    {/* Late Deduction (Per-Minute) */}
                    <td className="py-3 px-4 font-mono text-xs">
                      {(pay.totalLateDeduction || 0) > 0 ? (
                        <div>
                          <span className="text-amber-400 font-bold">
                            -{formatCurrency(pay.totalLateDeduction, true)}
                          </span>
                          <span className="block text-[10px] text-slate-400">({pay.totalLateMinutes || 0}m late)</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">₹0</span>
                      )}
                    </td>

                    {/* Overtime Pay */}
                    <td className="py-3 px-4 font-mono text-xs">
                      {(pay.totalOtPay || 0) > 0 ? (
                        <div>
                          <span className="text-sky-400 font-bold">+{formatCurrency(pay.totalOtPay, true)}</span>
                          <span className="block text-[10px] text-slate-400">({pay.totalOtMinutes || 0}m OT)</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">₹0</span>
                      )}
                    </td>

                    {/* Advance Deduction */}
                    <td className="py-3 px-4 font-mono text-xs">
                      {(pay.advanceDeduction || 0) > 0 ? (
                        <div>
                          <span className="text-amber-400 font-bold">
                            -{formatCurrency(pay.advanceDeduction, true)}
                          </span>
                          {(pay.advanceCarriedForward || 0) > 0 && (
                            <span className="block text-[10px] text-amber-300 font-normal">
                              (CF: ₹{pay.advanceCarriedForward})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">₹0</span>
                      )}
                    </td>

                    {/* Net Salary */}
                    <td className="py-3 px-4 font-mono font-bold text-base text-emerald-400">
                      {formatCurrency(pay.netSalary || 0, true)}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3 px-4">
                      {pay.paymentStatus === 'PAID' ? (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMarkAsPaid(pay.id)}
                          className="text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-950/60 hover:bg-amber-950 border border-amber-800 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>

                    {/* View Slip */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setViewingSlip(pay)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-medium flex items-center gap-1.5 ml-auto transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Slip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FORMAL INDUSTRIAL PAYSLIP MODAL (30-DAY BASIS)            */}
      {/* ========================================================= */}
      {viewingSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 text-white my-auto shadow-2xl space-y-6">
            
            {/* Payslip Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 block font-mono">
                  FACTORY SALARY VOUCHER & PAYSLIP (30-DAY BASIS)
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  Apex Industrial Fabrications Ltd.
                </h3>
                <p className="text-xs text-slate-400">
                  Plant Complex A • Salary Month: {viewingSlip.month}
                </p>
              </div>

              <button
                onClick={() => setViewingSlip(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Worker Info Block */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 block font-sans">Worker Name:</span>
                <span className="font-bold text-white text-sm">{viewingSlip.workerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-sans">Employee ID:</span>
                <span className="font-bold text-sky-400 text-sm">{viewingSlip.employeeId}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-sans">Working Time:</span>
                <span className="font-medium text-emerald-400">{viewingSlip.workingTime || '09:00 AM – 07:00 PM'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-sans">Daily Wage (Monthly ÷ 30):</span>
                <span className="font-medium text-amber-300">
                  ₹{Number(viewingSlip.dailyWage != null ? viewingSlip.dailyWage : ((viewingSlip.baseSalary || 15000) / 30)).toFixed(2)}/day
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-sans">Days Present:</span>
                <span className="font-medium text-slate-200">{viewingSlip.daysPresent ?? 30} of 30 Days</span>
              </div>
              <div>
                <span className="text-slate-500 block font-sans">Per-Minute Rate:</span>
                <span className="font-medium text-slate-300">
                  ₹{Number(viewingSlip.perMinuteSalary != null ? viewingSlip.perMinuteSalary : (((viewingSlip.baseSalary || 15000) / 30) / (viewingSlip.normalWorkingMinutesPerDay || 600))).toFixed(4)}/min
                </span>
              </div>
            </div>

            {/* Earnings vs Deductions Table */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Earnings */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-emerald-400 uppercase tracking-wider block pb-1 border-b border-slate-800">
                  Gross Earnings
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Monthly Base Salary:</span>
                  <span className="font-mono text-white">{formatCurrency(viewingSlip.baseSalary || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Overtime ({viewingSlip.totalOtMinutes || 0}m):</span>
                  <span className="font-mono text-sky-400">+{formatCurrency(viewingSlip.totalOtPay || 0, true)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-slate-800 text-white">
                  <span>Gross Total:</span>
                  <span className="font-mono">{formatCurrency((viewingSlip.baseSalary || 0) + (viewingSlip.totalOtPay || 0), true)}</span>
                </div>
              </div>

              {/* Deductions (NO Double Deduction) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-rose-400 uppercase tracking-wider block pb-1 border-b border-slate-800">
                  Policy Deductions
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Absent ({viewingSlip.daysAbsent || 0} Days):</span>
                  <span className="font-mono text-rose-400">-{formatCurrency(viewingSlip.absentDeduction || 0, true)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Late ({viewingSlip.totalLateMinutes || 0} Mins):</span>
                  <span className="font-mono text-rose-400">-{formatCurrency(viewingSlip.totalLateDeduction || 0, true)}</span>
                </div>
                {(viewingSlip.totalEarlyExitDeduction || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Early Exit ({viewingSlip.totalEarlyExitMinutes || 0}m):</span>
                    <span className="font-mono text-rose-400">-{formatCurrency(viewingSlip.totalEarlyExitDeduction || 0, true)}</span>
                  </div>
                )}
                {(viewingSlip.advanceDeduction || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-amber-300 font-semibold">Advance Deducted:</span>
                    <span className="font-mono text-amber-400 font-bold">-{formatCurrency(viewingSlip.advanceDeduction || 0, true)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t border-slate-800 text-white">
                  <span>Total Deductions:</span>
                  <span className="font-mono text-rose-400">
                    -{formatCurrency((viewingSlip.absentDeduction || 0) + (viewingSlip.totalLateDeduction || 0) + (viewingSlip.totalEarlyExitDeduction || 0) + (viewingSlip.advanceDeduction || 0), true)}
                  </span>
                </div>
              </div>

            </div>

            {/* Advance Carried Forward Balance Notice */}
            {(viewingSlip.advanceCarriedForward || 0) > 0 && (
              <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-amber-300 font-semibold block font-sans">Remaining Advance Carried Forward:</span>
                  <span className="text-[10px] text-slate-400 font-sans">Will be adjusted against upcoming salary cycles</span>
                </div>
                <span className="text-base font-bold text-amber-400">₹{formatCurrency(viewingSlip.advanceCarriedForward)}</span>
              </div>
            )}

            {/* Itemized Advance Salary Breakdown */}
            {viewingSlip.linkedAdvanceDeductions && viewingSlip.linkedAdvanceDeductions.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-sans">
                  Itemized Advance Salary Deductions Applied ({viewingSlip.linkedAdvanceDeductions.length})
                </span>
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Transaction ID</th>
                        <th className="py-2 px-3">Mode</th>
                        <th className="py-2 px-3 text-right">Advance Disbursed</th>
                        <th className="py-2 px-3 text-right text-amber-400">Deducted In Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {viewingSlip.linkedAdvanceDeductions.map(l => (
                        <tr key={l.transactionId} className="hover:bg-slate-900/50">
                          <td className="py-2 px-3">{l.advanceDate}</td>
                          <td className="py-2 px-3 text-sky-400 font-semibold">{l.transactionNumber}</td>
                          <td className="py-2 px-3">{l.paymentMode}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(l.totalAdvanceAmount)}</td>
                          <td className="py-2 px-3 text-right font-bold text-amber-400">-{formatCurrency(l.amountDeducted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Net Amount Highlight */}
            <div className="bg-emerald-950/60 border border-emerald-700/60 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-300 font-semibold uppercase block">
                  Net Payable Wage
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {formatCurrency(viewingSlip.netSalary, true)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-mono">
                  Disbursal Status: <strong className="text-white">{viewingSlip.paymentStatus}</strong>
                </span>
                <span className="text-[10px] text-slate-500">
                  Calculated on 30 Days • Checked by HR Admin
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-300" />
                <span>Print Payslip</span>
              </button>

              <button
                onClick={() => setViewingSlip(null)}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
