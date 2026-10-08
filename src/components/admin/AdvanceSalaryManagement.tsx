import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  IndianRupee,
  Plus,
  Search,
  Filter,
  Calendar,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  Edit3,
  Eye,
  FileSpreadsheet,
  Users,
  CreditCard,
  Building2,
  X,
  RefreshCw,
  Info,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Receipt,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Worker,
  AdvanceTransaction,
  AdvancePaymentMode,
  AdvanceStatus,
  CurrentUserSession,
  AdvanceDashboardStats,
  WorkerAdvanceSummary,
} from '../../types';
import { ApiService } from '../../services/api';
import { StorageService } from '../../services/storage';
import { formatCurrency } from '../../utils/timeCalculations';

interface AdvanceSalaryManagementProps {
  session: CurrentUserSession;
  workers: Worker[];
  onRefreshParent?: () => void;
}

export const AdvanceSalaryManagement: React.FC<AdvanceSalaryManagementProps> = ({
  session,
  workers,
  onRefreshParent,
}) => {
  // Navigation tabs within Advance Salary Module
  const [activeSubTab, setActiveSubTab] = useState<'DASHBOARD' | 'TRANSACTIONS' | 'WORKER_HISTORY' | 'MONTH_SUMMARY'>('DASHBOARD');

  // Month selector (default 2026-10)
  const [selectedMonth, setSelectedMonth] = useState('2026-10');

  // Data state
  const [advances, setAdvances] = useState<AdvanceTransaction[]>([]);
  const [stats, setStats] = useState<AdvanceDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('ALL');
  const [workerFilter, setWorkerFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'worker'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<AdvanceTransaction | null>(null);
  const [viewingAdvance, setViewingAdvance] = useState<AdvanceTransaction | null>(null);
  const [voidingAdvance, setVoidingAdvance] = useState<AdvanceTransaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [selectedWorkerHistory, setSelectedWorkerHistory] = useState<WorkerAdvanceSummary | null>(null);

  // Add/Edit Form State
  const [formWorkerId, setFormWorkerId] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formAdvanceDate, setFormAdvanceDate] = useState('2026-10-08');
  const [formSalaryMonth, setFormSalaryMonth] = useState('2026-10');
  const [formPaymentMode, setFormPaymentMode] = useState<AdvancePaymentMode>('Cash');
  const [formPaymentRef, setFormPaymentRef] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');

  // Fetch all advances & stats
  const fetchData = async () => {
    setLoading(true);
    try {
      const [advList, statData] = await Promise.all([
        ApiService.getAdvances(),
        ApiService.getAdvanceStats(selectedMonth),
      ]);
      setAdvances(advList);
      setStats(statData);
    } catch (err: any) {
      console.error('Error fetching advance data:', err);
      const fallbackList = StorageService.getAdvances();
      setAdvances(fallbackList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // Selected worker details for Add Modal
  const selectedWorker = useMemo(() => {
    return workers.find(w => w.id === formWorkerId);
  }, [workers, formWorkerId]);

  // Filtered workers for autocomplete in modal
  const filteredWorkersForSelection = useMemo(() => {
    if (!workerSearchTerm.trim()) return workers.filter(w => w.status === 'ACTIVE').slice(0, 8);
    const q = workerSearchTerm.toLowerCase();
    return workers.filter(
      w =>
        w.fullName.toLowerCase().includes(q) ||
        w.employeeId.toLowerCase().includes(q) ||
        w.department.toLowerCase().includes(q)
    );
  }, [workers, workerSearchTerm]);

  // Toast auto-clear
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  useEffect(() => {
    if (errorToast) {
      const t = setTimeout(() => setErrorToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorToast]);

  // Filtered and sorted transactions
  const filteredAdvances = useMemo(() => {
    let list = advances.slice();

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        a =>
          a.workerName.toLowerCase().includes(q) ||
          a.employeeId.toLowerCase().includes(q) ||
          a.transactionNumber.toLowerCase().includes(q) ||
          (a.paymentReference && a.paymentReference.toLowerCase().includes(q)) ||
          (a.remarks && a.remarks.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      list = list.filter(a => a.status === statusFilter);
    }

    // Payment Mode filter
    if (paymentModeFilter !== 'ALL') {
      list = list.filter(a => a.paymentMode === paymentModeFilter);
    }

    // Worker filter
    if (workerFilter !== 'ALL') {
      list = list.filter(a => a.workerId === workerFilter);
    }

    // Sort
    list.sort((a, b) => {
      let comp = 0;
      if (sortField === 'date') {
        comp = a.advanceDate.localeCompare(b.advanceDate);
      } else if (sortField === 'amount') {
        comp = a.amount - b.amount;
      } else if (sortField === 'worker') {
        comp = a.workerName.localeCompare(b.workerName);
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return list;
  }, [advances, searchQuery, statusFilter, paymentModeFilter, workerFilter, sortField, sortOrder]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredAdvances.length / itemsPerPage));
  const paginatedAdvances = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAdvances.slice(start, start + itemsPerPage);
  }, [filteredAdvances, currentPage]);

  // Worker-wise grouped summaries
  const workerSummaries = useMemo(() => {
    const map = new Map<string, { worker: Worker; transactions: AdvanceTransaction[] }>();

    workers.forEach(w => {
      map.set(w.id, { worker: w, transactions: [] });
    });

    advances.forEach(a => {
      const entry = map.get(a.workerId);
      if (entry) {
        entry.transactions.push(a);
      }
    });

    return Array.from(map.values())
      .filter(e => e.transactions.length > 0)
      .map(({ worker, transactions }) => {
        const validTx = transactions.filter(t => t.status !== 'VOIDED');
        const totalReceived = validTx.reduce((s, t) => s + t.amount, 0);
        const currentMonthReceived = validTx
          .filter(t => t.salaryMonth === selectedMonth || t.advanceDate.startsWith(selectedMonth))
          .reduce((s, t) => s + t.amount, 0);
        const totalDeducted = validTx.reduce((s, t) => s + t.deductedAmount, 0);
        const outstanding = validTx.reduce((s, t) => s + t.remainingAmount, 0);

        return {
          worker,
          totalReceived,
          currentMonthReceived,
          totalDeducted,
          outstanding,
          transactions,
        };
      })
      .sort((a, b) => b.totalReceived - a.totalReceived);
  }, [workers, advances, selectedMonth]);

  // Month-wise aggregated summaries
  const monthSummaries = useMemo(() => {
    const monthsMap = new Map<string, { totalDisbursed: number; totalDeducted: number; count: number; workers: Set<string> }>();

    advances.forEach(a => {
      if (a.status === 'VOIDED') return;
      const m = a.salaryMonth || a.advanceDate.substring(0, 7);
      const current = monthsMap.get(m) || { totalDisbursed: 0, totalDeducted: 0, count: 0, workers: new Set<string>() };
      current.totalDisbursed += a.amount;
      current.totalDeducted += a.deductedAmount;
      current.count += 1;
      current.workers.add(a.workerId);
      monthsMap.set(m, current);
    });

    return Array.from(monthsMap.entries())
      .map(([month, data]) => ({
        month,
        totalDisbursed: data.totalDisbursed,
        totalDeducted: data.totalDeducted,
        carriedForward: Math.max(0, data.totalDisbursed - data.totalDeducted),
        count: data.count,
        uniqueWorkers: data.workers.size,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [advances]);

  // Reset form
  const resetForm = () => {
    setFormWorkerId('');
    setFormAmount('');
    setFormAdvanceDate('2026-10-08');
    setFormSalaryMonth('2026-10');
    setFormPaymentMode('Cash');
    setFormPaymentRef('');
    setFormRemarks('');
    setWorkerSearchTerm('');
    setEditingAdvance(null);
  };

  // Open Add Modal
  const handleOpenAddModal = (presetWorkerId?: string) => {
    resetForm();
    if (presetWorkerId) {
      setFormWorkerId(presetWorkerId);
    }
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (adv: AdvanceTransaction) => {
    if (adv.status === 'VOIDED') {
      setErrorToast('Cannot edit a voided advance transaction.');
      return;
    }
    setEditingAdvance(adv);
    setFormWorkerId(adv.workerId);
    setFormAmount(adv.amount);
    setFormAdvanceDate(adv.advanceDate);
    setFormSalaryMonth(adv.salaryMonth);
    setFormPaymentMode(adv.paymentMode);
    setFormPaymentRef(adv.paymentReference || '');
    setFormRemarks(adv.remarks || '');
    setIsAddModalOpen(true);
  };

  // Save Advance (Add or Edit)
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formWorkerId) {
      setErrorToast('Please select a worker.');
      return;
    }

    const numAmount = Number(formAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorToast('Advance amount must be a valid number greater than zero.');
      return;
    }

    if (!formAdvanceDate) {
      setErrorToast('Advance payment date is required.');
      return;
    }

    try {
      if (editingAdvance) {
        // Edit existing advance
        await ApiService.updateAdvance(editingAdvance.id, {
          amount: numAmount,
          advanceDate: formAdvanceDate,
          salaryMonth: formSalaryMonth || formAdvanceDate.substring(0, 7),
          paymentMode: formPaymentMode,
          paymentReference: formPaymentRef.trim() || undefined,
          remarks: formRemarks.trim() || undefined,
          updatedBy: session.name,
        });
        setSuccessToast(`Advance transaction ${editingAdvance.transactionNumber} updated successfully.`);
      } else {
        // Create new advance
        const created = await ApiService.createAdvance({
          workerId: formWorkerId,
          amount: numAmount,
          advanceDate: formAdvanceDate,
          salaryMonth: formSalaryMonth || formAdvanceDate.substring(0, 7),
          paymentMode: formPaymentMode,
          paymentReference: formPaymentRef.trim() || undefined,
          remarks: formRemarks.trim() || undefined,
          createdBy: session.name,
        });
        setSuccessToast(`Advance of ₹${numAmount.toLocaleString()} saved successfully (ID: ${created.transactionNumber}).`);
      }

      setIsAddModalOpen(false);
      resetForm();
      await fetchData();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to save advance transaction.');
    }
  };

  // Void Advance
  const handleConfirmVoid = async () => {
    if (!voidingAdvance) return;
    if (!voidReason.trim()) {
      setErrorToast('Please enter a reason for cancelling this advance.');
      return;
    }

    try {
      await ApiService.voidAdvance(voidingAdvance.id, session.name, voidReason.trim());
      setSuccessToast(`Advance transaction ${voidingAdvance.transactionNumber} voided.`);
      setVoidingAdvance(null);
      setVoidReason('');
      await fetchData();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to void advance transaction.');
    }
  };

  // Open Worker Advance History modal
  const handleOpenWorkerHistoryModal = async (workerId: string) => {
    try {
      const summary = await ApiService.getWorkerAdvanceSummary(workerId);
      setSelectedWorkerHistory(summary);
    } catch (err: any) {
      setErrorToast('Could not load worker advance history.');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Transaction ID',
      'Worker Name',
      'Employee ID',
      'Department',
      'Advance Date',
      'Salary Month',
      'Amount (INR)',
      'Deducted in Payroll',
      'Remaining Balance',
      'Payment Mode',
      'Reference',
      'Status',
      'Recorded By',
      'Remarks',
    ];

    const rows = filteredAdvances.map(a => [
      a.transactionNumber,
      `"${a.workerName}"`,
      a.employeeId,
      `"${workers.find(w => w.id === a.workerId)?.department || 'Production'}"`,
      a.advanceDate,
      a.salaryMonth,
      a.amount,
      a.deductedAmount,
      a.remainingAmount,
      a.paymentMode,
      `"${a.paymentReference || '-'}"`,
      a.status,
      `"${a.createdBy}"`,
      `"${a.remarks || '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `factory_advance_salary_records_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notifications */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-950 border border-emerald-600 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="ml-2 text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorToast && (
        <div className="fixed top-5 right-5 z-50 bg-rose-950 border border-rose-600 text-rose-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="ml-2 text-rose-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Module Navigation Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Advance Salary Management</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Live Backend Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Disburse mid-month advance salary, track multi-transaction histories, and link automatic deductions into 30-day payroll.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* Add Advance Button */}
          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Advance</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Dashboard, All Transactions, Worker-wise History, Month Summary */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('DASHBOARD')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'DASHBOARD'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Overview Dashboard</span>
        </button>

        <button
          onClick={() => setActiveSubTab('TRANSACTIONS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'TRANSACTIONS'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>All Advance Transactions ({advances.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('WORKER_HISTORY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'WORKER_HISTORY'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Worker-wise Advance History ({workerSummaries.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('MONTH_SUMMARY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'MONTH_SUMMARY'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Month-wise Advance Summary</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. ADVANCE SALARY DASHBOARD                                */}
      {/* ========================================================= */}
      {activeSubTab === 'DASHBOARD' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Total Advance Paid This Month */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold uppercase tracking-wider">Disbursed This Month</span>
                <Wallet className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-300 font-mono">
                {formatCurrency(stats?.totalAdvancePaidMonth || 0)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                {selectedMonth} disbursal total
              </span>
            </div>

            {/* Workers Receiving Advance */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold uppercase tracking-wider">Beneficiary Workers</span>
                <Users className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-sky-400 font-mono">
                {stats?.totalWorkersWithAdvance || 0}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                Unique workers with advance
              </span>
            </div>

            {/* Total Transactions This Month */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold uppercase tracking-wider">Month Transactions</span>
                <Receipt className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-400 font-mono">
                {stats?.totalAdvanceTransactions || 0}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                Multi-advance allowed
              </span>
            </div>

            {/* Total Advance Deducted Through Payroll */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold uppercase tracking-wider">Deducted via Payroll</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono">
                {formatCurrency(stats?.monthAdvanceDeductions || 0)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                Subtracted from {selectedMonth} salary
              </span>
            </div>

            {/* Outstanding Advance Balance (Carried Forward) */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold uppercase tracking-wider">Outstanding Balance</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {formatCurrency(stats?.outstandingAdvanceBalance || 0)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                Pending future payroll recovery
              </span>
            </div>

          </div>

          {/* Quick Info & Policy Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/20 border border-amber-900/30 p-4 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-amber-200">
                Multi-Advance & 30-Day Salary Integration Rules Active:
              </p>
              <p className="text-slate-400 leading-relaxed">
                Workers can receive advance salary multiple times during the month (Cash, UPI, or Bank Transfer). When monthly payroll is generated, the system automatically sums all active advances for the worker, deducts up to the net earned salary, and safely carries forward any excess advance balance to the subsequent month. Double deduction is strictly prohibited.
              </p>
            </div>
          </div>

          {/* Recent Advance Transactions on Dashboard */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Recent Advance Transactions</h3>
              </div>
              <button
                onClick={() => setActiveSubTab('TRANSACTIONS')}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
              >
                View All &rarr;
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
                    <th className="py-3 px-4">TX ID</th>
                    <th className="py-3 px-4">Worker</th>
                    <th className="py-3 px-4">Advance Date</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4">Deducted / Remaining</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {advances.slice(0, 6).map(adv => (
                    <tr key={adv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-sky-400">
                        {adv.transactionNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {workers.find(w => w.id === adv.workerId)?.profilePhoto ? (
                            <img
                              src={workers.find(w => w.id === adv.workerId)?.profilePhoto}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold">
                              {adv.workerName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-white block leading-tight">{adv.workerName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{adv.employeeId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {adv.advanceDate}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-300 text-sm">
                        {formatCurrency(adv.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          adv.paymentMode === 'Cash'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                            : adv.paymentMode === 'UPI'
                            ? 'bg-sky-950/80 text-sky-400 border border-sky-800'
                            : 'bg-purple-950/80 text-purple-400 border border-purple-800'
                        }`}>
                          {adv.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className="text-rose-400 font-semibold">{formatCurrency(adv.deductedAmount)}</span>
                        <span className="text-slate-500"> / </span>
                        <span className="text-emerald-400 font-semibold">{formatCurrency(adv.remainingAmount)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          adv.status === 'FULLY_DEDUCTED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : adv.status === 'PARTIALLY_DEDUCTED'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : adv.status === 'VOIDED'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-sky-950 text-sky-400 border border-sky-800'
                        }`}>
                          {adv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingAdvance(adv)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenWorkerHistoryModal(adv.workerId)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors cursor-pointer"
                            title="Worker Advance History"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. ALL ADVANCE TRANSACTIONS TABLE                          */}
      {/* ========================================================= */}
      {activeSubTab === 'TRANSACTIONS' && (
        <div className="space-y-4">
          
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
            
            {/* Search Input */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search worker, EMP ID, ADV-XXX, ref..."
                className="bg-transparent text-white text-xs outline-none w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Worker Filter */}
            <select
              value={workerFilter}
              onChange={e => {
                setWorkerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 outline-none cursor-pointer"
            >
              <option value="ALL">All Workers</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>
                  {w.fullName} ({w.employeeId})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 outline-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">ACTIVE (Pending Deduction)</option>
              <option value="PARTIALLY_DEDUCTED">PARTIALLY_DEDUCTED</option>
              <option value="FULLY_DEDUCTED">FULLY_DEDUCTED</option>
              <option value="VOIDED">VOIDED</option>
            </select>

            {/* Payment Mode Filter */}
            <select
              value={paymentModeFilter}
              onChange={e => {
                setPaymentModeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 outline-none cursor-pointer"
            >
              <option value="ALL">All Modes</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Transactions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
                    <th className="py-3 px-4">TX Number</th>
                    <th className="py-3 px-4">Worker Profile</th>
                    <th className="py-3 px-4 cursor-pointer select-none" onClick={() => {
                      if (sortField === 'date') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortField('date'); setSortOrder('desc'); }
                    }}>
                      <div className="flex items-center gap-1">
                        <span>Advance Date</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer select-none" onClick={() => {
                      if (sortField === 'amount') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortField('amount'); setSortOrder('desc'); }
                    }}>
                      <div className="flex items-center gap-1">
                        <span>Amount</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Mode & Ref</th>
                    <th className="py-3 px-4">Deducted / Remaining</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recorded By</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {paginatedAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                        No advance salary transactions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedAdvances.map(adv => (
                      <tr key={adv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-sky-400">
                          {adv.transactionNumber}
                          {adv.recordSource === 'seed' && (
                            <span className="ml-1 text-[9px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded">demo</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {workers.find(w => w.id === adv.workerId)?.profilePhoto ? (
                              <img
                                src={workers.find(w => w.id === adv.workerId)?.profilePhoto}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover border border-slate-700"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold">
                                {adv.workerName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-white block leading-tight">{adv.workerName}</span>
                              <span className="text-[10px] font-mono text-slate-400">{adv.employeeId}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-300">
                          <div>{adv.advanceDate}</div>
                          <span className="text-[10px] text-slate-500">For {adv.salaryMonth}</span>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-amber-300 text-sm">
                          {formatCurrency(adv.amount)}
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            adv.paymentMode === 'Cash'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                              : adv.paymentMode === 'UPI'
                              ? 'bg-sky-950/80 text-sky-400 border border-sky-800'
                              : 'bg-purple-950/80 text-purple-400 border border-purple-800'
                          }`}>
                            {adv.paymentMode}
                          </span>
                          {adv.paymentReference && (
                            <span className="block text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[120px]" title={adv.paymentReference}>
                              Ref: {adv.paymentReference}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px]">
                          <div>
                            <span className="text-rose-400 font-semibold">Deducted: {formatCurrency(adv.deductedAmount)}</span>
                          </div>
                          <div>
                            <span className="text-emerald-400 font-semibold">Balance: {formatCurrency(adv.remainingAmount)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            adv.status === 'FULLY_DEDUCTED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : adv.status === 'PARTIALLY_DEDUCTED'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : adv.status === 'VOIDED'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-sky-950 text-sky-400 border border-sky-800'
                          }`}>
                            {adv.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          <span className="block truncate max-w-[110px]" title={adv.createdBy}>
                            {adv.createdBy}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingAdvance(adv)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {adv.status !== 'VOIDED' && adv.deductedAmount === 0 && (
                              <button
                                onClick={() => handleOpenEditModal(adv)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title="Edit Advance"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {adv.status !== 'VOIDED' && adv.deductedAmount === 0 && (
                              <button
                                onClick={() => {
                                  setVoidingAdvance(adv);
                                  setVoidReason('');
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                title="Void / Cancel Advance"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenWorkerHistoryModal(adv.workerId)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors cursor-pointer"
                              title="Worker History"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, filteredAdvances.length)} of {filteredAdvances.length} entries
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono px-2 py-1 bg-slate-950 rounded border border-slate-800 text-white">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. WORKER-WISE ADVANCE HISTORY VIEW                        */}
      {/* ========================================================= */}
      {activeSubTab === 'WORKER_HISTORY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workerSummaries.map(item => (
              <div
                key={item.worker.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl space-y-4 shadow-xl transition-all"
              >
                {/* Worker Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.worker.profilePhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm">{item.worker.fullName}</h4>
                      <span className="text-xs font-mono text-sky-400">{item.worker.employeeId}</span>
                      <span className="text-[11px] text-slate-400 block">{item.worker.department}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenAddModal(item.worker.id)}
                    className="p-2 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    title="Add Advance for Worker"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Salary & Duty details */}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs font-mono grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">Monthly Salary:</span>
                    <span className="text-amber-300 font-bold">{formatCurrency(item.worker.monthlySalary)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">Per Day (÷30):</span>
                    <span className="text-slate-300 font-bold">{formatCurrency(item.worker.monthlySalary / 30)}</span>
                  </div>
                </div>

                {/* Advance Financial Summary */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Total Advance Received:</span>
                    <span className="font-mono font-bold text-white">{formatCurrency(item.totalReceived)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>This Month ({selectedMonth}):</span>
                    <span className="font-mono font-bold text-amber-300">{formatCurrency(item.currentMonthReceived)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Deducted via Payroll:</span>
                    <span className="font-mono font-bold text-rose-400">-{formatCurrency(item.totalDeducted)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300 pt-1.5 border-t border-slate-800 font-bold">
                    <span>Outstanding Balance:</span>
                    <span className="font-mono text-emerald-400">{formatCurrency(item.outstanding)}</span>
                  </div>
                </div>

                {/* View Full History Button */}
                <button
                  onClick={() => handleOpenWorkerHistoryModal(item.worker.id)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>View All {item.transactions.length} Advances</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MONTH-WISE ADVANCE SUMMARY                              */}
      {/* ========================================================= */}
      {activeSubTab === 'MONTH_SUMMARY' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>Month-wise Advance Summary & Recovery Reconciliation</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reconciles total advances disbursed vs. total deducted in monthly payrolls and balances carried forward.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
                  <th className="py-3 px-4">Salary Month</th>
                  <th className="py-3 px-4">Transactions</th>
                  <th className="py-3 px-4">Workers</th>
                  <th className="py-3 px-4">Total Disbursed (₹)</th>
                  <th className="py-3 px-4">Deducted in Payroll (₹)</th>
                  <th className="py-3 px-4">Carried Forward (₹)</th>
                  <th className="py-3 px-4 text-right">Recovery Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {monthSummaries.map(m => {
                  const rate = m.totalDisbursed > 0 ? Math.round((m.totalDeducted / m.totalDisbursed) * 100) : 0;
                  return (
                    <tr key={m.month} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white text-sm">
                        {m.month}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {m.count} Advances
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {m.uniqueWorkers} Workers
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-300">
                        {formatCurrency(m.totalDisbursed)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-400">
                        {formatCurrency(m.totalDeducted)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {formatCurrency(m.carriedForward)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          rate >= 100
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : rate > 0
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {rate}% Recovered
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT ADVANCE SALARY                          */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 text-white my-auto shadow-2xl space-y-5 animate-fade-in">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block font-mono">
                  {editingAdvance ? 'EDIT ADVANCE SALARY RECORD' : 'GRANT ADVANCE SALARY TO WORKER'}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {editingAdvance ? `Update ${editingAdvance.transactionNumber}` : 'Record New Advance Payment'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} className="space-y-4">
              
              {/* Worker Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Select Worker <span className="text-rose-400">*</span>
                </label>

                {!formWorkerId ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl">
                      <Search className="w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={workerSearchTerm}
                        onChange={e => setWorkerSearchTerm(e.target.value)}
                        placeholder="Search worker by name, EMP ID, department..."
                        className="bg-transparent text-white text-xs outline-none w-full"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-800 bg-slate-950 border border-slate-800 rounded-xl">
                      {filteredWorkersForSelection.map(w => (
                        <div
                          key={w.id}
                          onClick={() => setFormWorkerId(w.id)}
                          className="p-2.5 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={w.profilePhoto}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border border-slate-700"
                            />
                            <div>
                              <span className="font-bold text-white text-xs block">{w.fullName}</span>
                              <span className="text-[10px] font-mono text-slate-400">{w.employeeId} • {w.department}</span>
                            </div>
                          </div>
                          <div className="text-right font-mono text-xs">
                            <span className="text-amber-300 font-semibold">{formatCurrency(w.monthlySalary)}</span>
                            <span className="block text-[10px] text-slate-500">{w.workingTime}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Worker Selected Badge */
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedWorker?.profilePhoto}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <div className="font-bold text-white text-sm">{selectedWorker?.fullName}</div>
                        <div className="text-xs font-mono text-sky-400">{selectedWorker?.employeeId} • {selectedWorker?.department}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Monthly Salary: <strong className="text-amber-300">{formatCurrency(selectedWorker?.monthlySalary)}</strong>
                          {' • '}Duty: <strong className="text-emerald-400">{selectedWorker?.workingTime}</strong>
                        </div>
                      </div>
                    </div>

                    {!editingAdvance && (
                      <button
                        type="button"
                        onClick={() => setFormWorkerId('')}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg cursor-pointer"
                      >
                        Change
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Advance Amount & Payment Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Advance Amount (₹) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-amber-400 font-mono text-sm">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="50"
                      required
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 2000"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm font-mono text-amber-300 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Payment Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formAdvanceDate}
                    onChange={e => {
                      setFormAdvanceDate(e.target.value);
                      setFormSalaryMonth(e.target.value.substring(0, 7));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Payment Mode & Transaction Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Payment Mode <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formPaymentMode}
                    onChange={e => setFormPaymentMode(e.target.value as AdvancePaymentMode)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Cash">Cash (Factory Gate / Cashier)</option>
                    <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / IMPS / RTGS)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Transaction Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={formPaymentRef}
                    onChange={e => setFormPaymentRef(e.target.value)}
                    placeholder="e.g. UPI/261008/94821 or Cheque #12"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Salary Month & Reason / Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Applicable Salary Month
                  </label>
                  <input
                    type="month"
                    value={formSalaryMonth}
                    onChange={e => setFormSalaryMonth(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Month when recovery will be processed
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Reason / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={formRemarks}
                    onChange={e => setFormRemarks(e.target.value)}
                    placeholder="e.g. Medical emergency, Festival shopping..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Auto Metadata Info */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Authorized Admin:</span>
                  <span className="text-white font-medium">{session.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deduction Policy:</span>
                  <span className="text-emerald-400 font-medium">Automatic 30-Day Payroll Deduction</span>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  {editingAdvance ? 'Save Changes' : 'Confirm & Save Advance'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VIEW TRANSACTION DETAILS                           */}
      {/* ========================================================= */}
      {viewingAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white my-auto shadow-2xl space-y-5 animate-fade-in">
            
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block font-mono">
                  ADVANCE SALARY VOUCHER DETAILS
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">
                  Transaction {viewingAdvance.transactionNumber}
                </h3>
              </div>
              <button
                onClick={() => setViewingAdvance(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block font-sans">Worker Name:</span>
                  <span className="font-bold text-white text-sm">{viewingAdvance.workerName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Employee ID:</span>
                  <span className="font-bold text-sky-400 text-sm">{viewingAdvance.employeeId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Advance Date:</span>
                  <span className="font-medium text-slate-200">{viewingAdvance.advanceDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Salary Month:</span>
                  <span className="font-medium text-slate-200">{viewingAdvance.salaryMonth}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Advance Amount:</span>
                  <span className="text-base font-bold text-amber-300">{formatCurrency(viewingAdvance.amount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Payment Mode:</span>
                  <span className="font-bold text-white">{viewingAdvance.paymentMode}</span>
                </div>
                {viewingAdvance.paymentReference && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block font-sans">Payment Reference:</span>
                    <span className="text-slate-300">{viewingAdvance.paymentReference}</span>
                  </div>
                )}
                {viewingAdvance.remarks && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block font-sans">Remarks / Reason:</span>
                    <span className="text-slate-300 font-sans">{viewingAdvance.remarks}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block font-sans">Payroll Deducted:</span>
                  <span className="text-rose-400 font-bold">{formatCurrency(viewingAdvance.deductedAmount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Remaining Balance:</span>
                  <span className="text-emerald-400 font-bold">{formatCurrency(viewingAdvance.remainingAmount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Status:</span>
                  <span className="font-bold text-white">{viewingAdvance.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Recorded By:</span>
                  <span className="text-slate-300">{viewingAdvance.createdBy}</span>
                </div>
              </div>

              {viewingAdvance.voidReason && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-rose-300">
                  <span className="font-bold block">Voided Information:</span>
                  <span>Reason: {viewingAdvance.voidReason} (by {viewingAdvance.voidedBy || 'Admin'})</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setViewingAdvance(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VOID / CANCEL ADVANCE TRANSACTION                  */}
      {/* ========================================================= */}
      {voidingAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-rose-900/50 rounded-2xl max-w-md w-full p-6 text-white my-auto shadow-2xl space-y-4 animate-fade-in">
            
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-base text-white">Void Advance Transaction</h3>
                <span className="text-xs text-rose-300 font-mono">{voidingAdvance.transactionNumber} • {formatCurrency(voidingAdvance.amount)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to void this advance for <strong>{voidingAdvance.workerName}</strong>?
              The transaction will be preserved in audit logs and financial history with status <strong className="text-rose-400">VOIDED</strong>, and will not be deducted in payroll.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Reason for Cancellation <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g. Worker cancelled request, wrong amount entered..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setVoidingAdvance(null);
                  setVoidReason('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Keep Active
              </button>
              <button
                onClick={handleConfirmVoid}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Confirm Void
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: WORKER ADVANCE HISTORY DETAILS                     */}
      {/* ========================================================= */}
      {selectedWorkerHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 text-white my-auto shadow-2xl space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedWorkerHistory.profilePhoto}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover border border-slate-700"
                />
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedWorkerHistory.workerName}</h3>
                  <span className="text-xs font-mono text-sky-400">{selectedWorkerHistory.employeeId} • {selectedWorkerHistory.department}</span>
                  <span className="text-[11px] font-mono text-amber-300 block">
                    Monthly Salary: {formatCurrency(selectedWorkerHistory.monthlySalary)} (30d basis)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedWorkerHistory(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block font-sans text-[10px]">Total Advances:</span>
                <span className="text-white font-bold">{formatCurrency(selectedWorkerHistory.totalAdvanceReceived)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block font-sans text-[10px]">Current Month:</span>
                <span className="text-amber-300 font-bold">{formatCurrency(selectedWorkerHistory.currentMonthAdvance)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block font-sans text-[10px]">Deducted:</span>
                <span className="text-rose-400 font-bold">-{formatCurrency(selectedWorkerHistory.totalAdvanceDeducted)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block font-sans text-[10px]">Balance Left:</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(selectedWorkerHistory.outstandingBalance)}</span>
              </div>
            </div>

            {/* List of Advances for this worker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Advance Salary Transactions ({selectedWorkerHistory.transactions.length})
                </h4>
                <button
                  onClick={() => {
                    handleOpenAddModal(selectedWorkerHistory.workerId);
                    setSelectedWorkerHistory(null);
                  }}
                  className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Advance</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono text-[10px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">TX ID</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Deducted</th>
                      <th className="py-2.5 px-3">Remaining</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {selectedWorkerHistory.transactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-slate-300">{t.advanceDate}</td>
                        <td className="py-2 px-3 text-sky-400 font-bold">{t.transactionNumber}</td>
                        <td className="py-2 px-3 text-amber-300 font-bold">{formatCurrency(t.amount)}</td>
                        <td className="py-2 px-3">{t.paymentMode}</td>
                        <td className="py-2 px-3 text-rose-400">{formatCurrency(t.deductedAmount)}</td>
                        <td className="py-2 px-3 text-emerald-400">{formatCurrency(t.remainingAmount)}</td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            t.status === 'FULLY_DEDUCTED'
                              ? 'text-emerald-400 bg-emerald-950'
                              : t.status === 'PARTIALLY_DEDUCTED'
                              ? 'text-amber-400 bg-amber-950'
                              : t.status === 'VOIDED'
                              ? 'text-rose-400 bg-rose-950'
                              : 'text-sky-400 bg-sky-950'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payroll Deductions Log */}
            {selectedWorkerHistory.deductions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Payroll Deduction Recoveries ({selectedWorkerHistory.deductions.length})
                </h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono space-y-2">
                  {selectedWorkerHistory.deductions.map(d => (
                    <div key={d.id} className="flex justify-between items-center py-1 border-b border-slate-900 last:border-b-0">
                      <div>
                        <span className="text-white font-bold">{d.month} Payroll</span>
                        <span className="text-slate-500 text-[10px] ml-2 font-mono">({d.transactionNumber})</span>
                      </div>
                      <span className="text-rose-400 font-bold">-{formatCurrency(d.deductedAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedWorkerHistory(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close History
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
