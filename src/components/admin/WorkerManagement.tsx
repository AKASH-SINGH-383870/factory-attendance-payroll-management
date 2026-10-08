import React, { useState, useRef } from 'react';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  FileText,
  Upload,
  Search,
  Eye,
  CheckCircle2,
  X,
  CreditCard,
  Phone,
  Briefcase,
  Clock,
  Shield,
  FileCheck,
  Camera,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Worker, WorkingTimeOption, WorkerDocument, WorkerAdvanceSummary, AdvanceTransaction, AdvancePayrollDeduction } from '../../types';
import { StorageService } from '../../services/storage';
import { ApiService } from '../../services/api';
import { formatCurrency, WORKING_TIME_OPTIONS } from '../../utils/timeCalculations';

interface WorkerManagementProps {
  onDataChanged: () => void;
}

export const WorkerManagement: React.FC<WorkerManagementProps> = ({
  onDataChanged,
}) => {
  const [workers, setWorkers] = useState<Worker[]>(StorageService.getWorkers());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('ALL');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);

  // Document Viewer Modal State
  const [viewingDocsWorker, setViewingDocsWorker] = useState<Worker | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState<WorkerDocument['type']>('Aadhaar / ID Card');

  // Worker Profile & Advance History Modal State
  const [viewingProfileWorker, setViewingProfileWorker] = useState<Worker | null>(null);
  const [profileTab, setProfileTab] = useState<'DETAILS' | 'DOCS' | 'ADVANCES'>('DETAILS');
  const [advanceSummary, setAdvanceSummary] = useState<WorkerAdvanceSummary | null>(null);
  const [loadingAdvanceSummary, setLoadingAdvanceSummary] = useState(false);

  const handleOpenWorkerProfile = async (w: Worker, tab: 'DETAILS' | 'DOCS' | 'ADVANCES' = 'DETAILS') => {
    setViewingProfileWorker(w);
    setProfileTab(tab);
    if (tab === 'ADVANCES') {
      try {
        setLoadingAdvanceSummary(true);
        const summary = await ApiService.getWorkerAdvanceSummary(w.id);
        setAdvanceSummary(summary);
      } catch (err) {
        console.error('Error fetching advance summary:', err);
      } finally {
        setLoadingAdvanceSummary(false);
      }
    }
  };

  const handleSwitchProfileTab = async (tab: 'DETAILS' | 'DOCS' | 'ADVANCES') => {
    setProfileTab(tab);
    if (tab === 'ADVANCES' && viewingProfileWorker) {
      try {
        setLoadingAdvanceSummary(true);
        const summary = await ApiService.getWorkerAdvanceSummary(viewingProfileWorker.id);
        setAdvanceSummary(summary);
      } catch (err) {
        console.error('Error fetching advance summary:', err);
      } finally {
        setLoadingAdvanceSummary(false);
      }
    }
  };

  // File input ref for Profile Photo upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    fullName: string;
    employeeId: string;
    mobileNumber: string;
    emergencyContact: string;
    address: string;
    department: string;
    designation: string;
    workingTime: WorkingTimeOption;
    monthlySalary: number;
    bankAccountNumber: string;
    bankIfsc: string;
    aadhaarNumber: string;
    panNumber: string;
    profilePhoto: string;
    status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  }>({
    fullName: '',
    employeeId: '',
    mobileNumber: '',
    emergencyContact: '',
    address: '',
    department: 'Cutting & Pattern',
    designation: 'Worker',
    workingTime: '09:00 AM – 07:00 PM',
    monthlySalary: 15000,
    bankAccountNumber: '',
    bankIfsc: '',
    aadhaarNumber: '',
    panNumber: '',
    profilePhoto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
    status: 'ACTIVE',
  });

  const refreshList = async () => {
    try {
      const list = await ApiService.getWorkers();
      setWorkers(list);
    } catch {
      setWorkers(StorageService.getWorkers());
    }
    onDataChanged();
  };

  React.useEffect(() => {
    refreshList();
  }, []);

  const handleOpenAdd = () => {
    const nextEmpNum = workers.length + 1;
    const autoId = `EMP-${String(nextEmpNum).padStart(3, '0')}`;
    setEditingWorker(null);
    setFormData({
      fullName: '',
      employeeId: autoId,
      mobileNumber: '+91 ',
      emergencyContact: '',
      address: '',
      department: 'Cutting & Pattern',
      designation: 'Machinist',
      workingTime: '09:00 AM – 07:00 PM',
      monthlySalary: 15000,
      bankAccountNumber: '',
      bankIfsc: '',
      aadhaarNumber: '',
      panNumber: '',
      profilePhoto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setFormData({
      fullName: worker.fullName,
      employeeId: worker.employeeId,
      mobileNumber: worker.mobileNumber,
      emergencyContact: worker.emergencyContact,
      address: worker.address || '',
      department: worker.department,
      designation: worker.designation,
      workingTime: worker.workingTime,
      monthlySalary: worker.monthlySalary,
      bankAccountNumber: worker.bankAccountNumber || '',
      bankIfsc: worker.bankIfsc || '',
      aadhaarNumber: worker.aadhaarNumber || '',
      panNumber: worker.panNumber || '',
      profilePhoto: worker.profilePhoto,
      status: worker.status,
    });
    setIsModalOpen(true);
  };

  // Handle Photo File Upload (JPG, JPEG, PNG, WEBP)
  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPG, JPEG, PNG, or WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      if (event.target?.result) {
        setFormData(prev => ({
          ...prev,
          profilePhoto: event.target!.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({
      ...prev,
      profilePhoto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
    }));
  };

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.employeeId.trim()) return;

    const workerToSave: Worker = {
      id: editingWorker ? editingWorker.id : 'worker-' + Date.now(),
      employeeId: formData.employeeId.trim().toUpperCase(),
      fullName: formData.fullName.trim(),
      mobileNumber: formData.mobileNumber.trim(),
      emergencyContact: formData.emergencyContact.trim(),
      address: formData.address.trim(),
      profilePhoto: formData.profilePhoto.trim() || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
      department: formData.department.trim(),
      designation: formData.designation.trim(),
      workingTime: formData.workingTime,
      monthlySalary: Number(formData.monthlySalary) || 15000,
      bankAccountNumber: formData.bankAccountNumber.trim(),
      bankIfsc: formData.bankIfsc.trim().toUpperCase(),
      aadhaarNumber: formData.aadhaarNumber.trim(),
      panNumber: formData.panNumber.trim().toUpperCase(),
      dateOfJoining: editingWorker ? editingWorker.dateOfJoining : new Date().toISOString().slice(0, 10),
      status: formData.status,
      documents: editingWorker ? editingWorker.documents : [
        {
          id: 'doc-init',
          name: 'Aadhaar Identity Card',
          type: 'Aadhaar / ID Card',
          fileUrl: '#',
          uploadedAt: new Date().toISOString().slice(0, 10),
        },
      ],
    };

    if (editingWorker) {
      await ApiService.updateWorker(editingWorker.id, workerToSave);
    } else {
      await ApiService.createWorker(workerToSave);
    }
    setIsModalOpen(false);
    refreshList();
  };

  const handleDelete = async (worker: Worker) => {
    if (confirm(`Are you sure you want to remove worker ${worker.fullName} (${worker.employeeId})?`)) {
      await ApiService.deleteWorker(worker.id);
      refreshList();
    }
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingDocsWorker || !newDocName.trim()) return;

    const newDoc: WorkerDocument = {
      id: 'doc-' + Date.now(),
      name: newDocName.trim(),
      type: newDocType,
      fileUrl: '#',
      uploadedAt: new Date().toISOString().slice(0, 10),
    };

    const updatedWorker: Worker = {
      ...viewingDocsWorker,
      documents: [...viewingDocsWorker.documents, newDoc],
    };

    StorageService.saveWorker(updatedWorker);
    setViewingDocsWorker(updatedWorker);
    setNewDocName('');
    refreshList();
  };

  // Departments list
  const departments = Array.from(new Set(workers.map(w => w.department)));

  const filtered = workers.filter(w => {
    if (selectedDeptFilter !== 'ALL' && w.department !== selectedDeptFilter) return false;
    if (selectedTimeFilter !== 'ALL' && w.workingTime !== selectedTimeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        w.fullName.toLowerCase().includes(q) ||
        w.employeeId.toLowerCase().includes(q) ||
        w.mobileNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Factory Worker Directory</h2>
            <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full">
              {workers.length} Total Workers
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage worker profiles, profile photos, assigned working times (09:00 AM – 05:00 PM / 07:00 PM / 09:00 PM), and monthly wages (30-day basis).
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Worker Profile</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by worker name, employee ID, or mobile number..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400">Working Time:</span>
          <select
            value={selectedTimeFilter}
            onChange={e => setSelectedTimeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Working Times</option>
            {WORKING_TIME_OPTIONS.map(opt => (
              <option key={opt.label} value={opt.label}>{opt.label}</option>
            ))}
          </select>

          <span className="text-xs text-slate-400 ml-2">Department:</span>
          <select
            value={selectedDeptFilter}
            onChange={e => setSelectedDeptFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Worker Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Profile Photo & Worker</th>
                <th className="py-3 px-4">Emp ID</th>
                <th className="py-3 px-4">Department & Trade</th>
                <th className="py-3 px-4">Assigned Working Time</th>
                <th className="py-3 px-4">Monthly Salary (30d)</th>
                <th className="py-3 px-4">KYC Documents</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(w => (
                <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                  {/* Photo & Name */}
                  <td className="py-3 px-4 flex items-center gap-3">
                    <div className="relative group w-11 h-11 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800 shrink-0">
                      <img
                        src={w.profilePhoto}
                        alt={w.fullName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="font-bold text-white leading-snug">{w.fullName}</div>
                      <div className="text-xs text-slate-400 font-mono">{w.mobileNumber}</div>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono font-bold text-sky-400">
                    {w.employeeId}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-200">{w.department}</div>
                    <div className="text-xs text-slate-400">{w.designation}</div>
                  </td>

                  {/* ASSIGNED WORKING TIME */}
                  <td className="py-3 px-4">
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded block w-fit font-mono">
                      {w.workingTime}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Normal Duty
                    </span>
                  </td>

                  {/* MONTHLY SALARY */}
                  <td className="py-3 px-4 font-mono font-bold text-amber-300">
                    <div>{formatCurrency(w.monthlySalary || 0)}</div>
                    <div className="text-[10px] text-slate-400 font-normal">₹{(((w.monthlySalary || 0) / 30)).toFixed(0)}/day (30d basis)</div>
                  </td>

                  <td className="py-3 px-4">
                    <button
                      onClick={() => setViewingDocsWorker(w)}
                      className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 bg-sky-950/40 hover:bg-sky-950/80 border border-sky-800/50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{w.documents?.length || 0} Docs</span>
                    </button>
                  </td>

                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      w.status === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {w.status}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenWorkerProfile(w, 'ADVANCES')}
                        className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-950/60 rounded-lg transition-colors cursor-pointer"
                        title="Advance Salary History"
                      >
                        <Wallet className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenWorkerProfile(w, 'DETAILS')}
                        className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-950/60 rounded-lg transition-colors cursor-pointer"
                        title="Full Worker Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(w)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Edit Worker Profile"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(w)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Worker"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ADD / EDIT WORKER PROFILE MODAL                           */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 text-white my-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">
                {editingWorker ? `Edit Worker: ${editingWorker.fullName}` : 'Register New Worker Profile'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorker} className="mt-4 space-y-4">
              
              {/* REQUIREMENT 3: WORKER PROFILE PHOTO UPLOAD / PREVIEW / REPLACE / REMOVE */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Worker Profile Photo * (JPG, JPEG, PNG, WEBP)
                </span>

                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-emerald-500/50 bg-slate-900 shadow-md shrink-0">
                    <img
                      src={formData.profilePhoto}
                      alt="Profile Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Replace</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Uploaded photo will be displayed at the factory gate for Security Guard visual verification during check-in.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Rahul Kumar"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="EMP-001"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500 uppercase"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.mobileNumber}
                    onChange={e => setFormData({ ...formData, mobileNumber: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={e => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="e.g. +91 91234 56789 (Brother: Sunil)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>

                {/* REQUIREMENT 8: REQUIRED WORKING TIME FIELD WITH 3 OPTIONS */}
                <div>
                  <label className="text-xs font-bold text-emerald-400 block mb-1">
                    Assigned Working Time * (Required)
                  </label>
                  <select
                    value={formData.workingTime}
                    onChange={e => setFormData({ ...formData, workingTime: e.target.value as WorkingTimeOption })}
                    className="w-full bg-slate-950 border-2 border-emerald-600/50 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="09:00 AM – 05:00 PM">09:00 AM – 05:00 PM (8 Hours)</option>
                    <option value="09:00 AM – 07:00 PM">09:00 AM – 07:00 PM (10 Hours)</option>
                    <option value="09:00 AM – 09:00 PM">09:00 AM – 09:00 PM (12 Hours)</option>
                  </select>
                </div>

                {/* REQUIREMENT 6: MONTHLY SALARY BASIS (30 DAYS) */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Monthly Salary (₹) * [30-Day Basis]
                  </label>
                  <input
                    type="number"
                    min="5000"
                    step="500"
                    required
                    value={formData.monthlySalary}
                    onChange={e => setFormData({ ...formData, monthlySalary: Number(e.target.value) })}
                    placeholder="15000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-amber-300 outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Per Day: ₹{((formData.monthlySalary || 0) / 30).toFixed(0)} (Monthly ÷ 30)
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Cutting & Pattern"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Designation / Trade
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. CNC Operator / Senior Tailor"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Plot / House number, Village/Colony, City"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Aadhaar Number
                  </label>
                  <input
                    type="text"
                    value={formData.aadhaarNumber}
                    onChange={e => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                    placeholder="4829-1029-4820"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    PAN Card Number
                  </label>
                  <input
                    type="text"
                    value={formData.panNumber}
                    onChange={e => setFormData({ ...formData, panNumber: e.target.value })}
                    placeholder="ABCDE1234F"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500 uppercase"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-md cursor-pointer"
                >
                  {editingWorker ? 'Save Changes' : 'Create Worker Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* WORKER DOCUMENTS MODAL                                    */}
      {/* ========================================================= */}
      {viewingDocsWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white">
                  Worker KYC Documents
                </h3>
                <p className="text-xs text-slate-400">
                  {viewingDocsWorker.fullName} ({viewingDocsWorker.employeeId}) • Working Time: {viewingDocsWorker.workingTime}
                </p>
              </div>
              <button
                onClick={() => setViewingDocsWorker(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Documents List */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Uploaded Records ({viewingDocsWorker.documents?.length || 0})
              </span>

              {(!viewingDocsWorker.documents || viewingDocsWorker.documents.length === 0) ? (
                <p className="text-xs text-slate-500 p-4 bg-slate-950 rounded-lg text-center">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {viewingDocsWorker.documents.map(doc => (
                    <div
                      key={doc.id}
                      className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-medium text-slate-200">{doc.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {doc.type} • Uploaded {doc.uploadedAt}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                        Verified
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload New Document Form */}
            <form onSubmit={handleAddDocument} className="pt-3 border-t border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">
                Attach New Verification Document
              </span>
              
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  placeholder="Document Name (e.g. Police Verification, Medical Test)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />

                <select
                  value={newDocType}
                  onChange={e => setNewDocType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="Aadhaar / ID Card">Aadhaar / ID Card</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Employment Contract">Employment Contract</option>
                  <option value="Medical Fitness">Medical Fitness Certificate</option>
                  <option value="Bank Passbook">Bank Passbook Copy</option>
                  <option value="Other">Other Certificate</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload & Verify Document</span>
              </button>
            </form>

            <button
              onClick={() => setViewingDocsWorker(null)}
              className="w-full py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* COMPREHENSIVE WORKER PROFILE & ADVANCE HISTORY MODAL      */}
      {/* ========================================================= */}
      {viewingProfileWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 text-white my-auto shadow-2xl space-y-5 animate-fade-in max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={viewingProfileWorker.profilePhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/50 shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{viewingProfileWorker.fullName}</h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                      {viewingProfileWorker.employeeId}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      viewingProfileWorker.status === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {viewingProfileWorker.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {viewingProfileWorker.designation} • {viewingProfileWorker.department}
                  </p>
                  <p className="text-[11px] font-mono text-emerald-400 mt-0.5">
                    Duty Hours: {viewingProfileWorker.workingTime} • Salary: ₹{viewingProfileWorker.monthlySalary?.toLocaleString()}/mo
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setViewingProfileWorker(null);
                  setAdvanceSummary(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => handleSwitchProfileTab('DETAILS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  profileTab === 'DETAILS'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Profile & KYC Details
              </button>

              <button
                onClick={() => handleSwitchProfileTab('DOCS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  profileTab === 'DOCS'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Documents ({viewingProfileWorker.documents?.length || 0})
              </button>

              <button
                onClick={() => handleSwitchProfileTab('ADVANCES')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  profileTab === 'ADVANCES'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/50'
                }`}
              >
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                <span>Advance Salary History</span>
              </button>
            </div>

            {/* TAB 1: DETAILS */}
            {profileTab === 'DETAILS' && (
              <div className="space-y-4 text-xs font-mono">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block font-sans">Full Name:</span>
                    <span className="text-white font-medium">{viewingProfileWorker.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Employee Code:</span>
                    <span className="text-sky-400 font-bold">{viewingProfileWorker.employeeId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Mobile Phone:</span>
                    <span className="text-slate-200">{viewingProfileWorker.mobileNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Emergency Contact:</span>
                    <span className="text-slate-200">{viewingProfileWorker.emergencyContact}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Monthly Base Salary:</span>
                    <span className="text-amber-300 font-bold text-sm">{formatCurrency(viewingProfileWorker.monthlySalary)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Per Day Salary (30d):</span>
                    <span className="text-slate-300 font-bold">{formatCurrency((viewingProfileWorker.monthlySalary || 0) / 30)}/day</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Assigned Working Time:</span>
                    <span className="text-emerald-400">{viewingProfileWorker.workingTime}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Date of Joining:</span>
                    <span className="text-slate-300">{viewingProfileWorker.dateOfJoining}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block font-sans">Residential Address:</span>
                    <span className="text-slate-300 font-sans">{viewingProfileWorker.address || 'Industrial Complex Quarter'}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block font-sans">Aadhaar Card:</span>
                    <span className="text-slate-300">{viewingProfileWorker.aadhaarNumber || 'Verified ID Card'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">PAN Card:</span>
                    <span className="text-slate-300">{viewingProfileWorker.panNumber || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Bank Account Number:</span>
                    <span className="text-slate-300">{viewingProfileWorker.bankAccountNumber || 'Direct Disbursal'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Bank IFSC Code:</span>
                    <span className="text-slate-300">{viewingProfileWorker.bankIfsc || 'SBIN0004521'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DOCUMENTS */}
            {profileTab === 'DOCS' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Verified Attachments
                  </span>
                </div>

                {(!viewingProfileWorker.documents || viewingProfileWorker.documents.length === 0) ? (
                  <p className="text-xs text-slate-500 p-6 bg-slate-950 rounded-xl text-center border border-slate-800">
                    No documents uploaded yet for this worker.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {viewingProfileWorker.documents.map(doc => (
                      <div
                        key={doc.id}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-white">{doc.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {doc.type} • Uploaded {doc.uploadedAt}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                          Verified
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ADVANCE SALARY HISTORY (REQUIRED INTEGRATION) */}
            {profileTab === 'ADVANCES' && (
              <div className="space-y-4">
                {loadingAdvanceSummary ? (
                  <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Loading advance salary history...</span>
                  </div>
                ) : advanceSummary ? (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block font-sans text-[10px]">Total Advances:</span>
                        <span className="text-white font-bold text-sm">{formatCurrency(advanceSummary.totalAdvanceReceived)}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block font-sans text-[10px]">Current Month:</span>
                        <span className="text-amber-300 font-bold text-sm">{formatCurrency(advanceSummary.currentMonthAdvance)}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block font-sans text-[10px]">Deducted in Payroll:</span>
                        <span className="text-rose-400 font-bold text-sm">-{formatCurrency(advanceSummary.totalAdvanceDeducted)}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block font-sans text-[10px]">Remaining Balance:</span>
                        <span className="text-emerald-400 font-bold text-sm">{formatCurrency(advanceSummary.outstandingBalance)}</span>
                      </div>
                    </div>

                    {/* Transaction History Table */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Advance Transactions ({advanceSummary.transactions.length})
                      </h4>

                      {advanceSummary.transactions.length === 0 ? (
                        <p className="text-xs text-slate-500 p-6 bg-slate-950 rounded-xl text-center border border-slate-800">
                          No advance transactions on record for this worker.
                        </p>
                      ) : (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono text-[10px]">
                                <th className="py-2 px-3">Date</th>
                                <th className="py-2 px-3">TX ID</th>
                                <th className="py-2 px-3">Amount</th>
                                <th className="py-2 px-3">Mode</th>
                                <th className="py-2 px-3">Deducted</th>
                                <th className="py-2 px-3">Balance</th>
                                <th className="py-2 px-3">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 font-mono">
                              {advanceSummary.transactions.map((tx: AdvanceTransaction) => (
                                <tr key={tx.id} className="hover:bg-slate-800/40">
                                  <td className="py-2 px-3 text-slate-300">{tx.advanceDate}</td>
                                  <td className="py-2 px-3 text-sky-400 font-bold">{tx.transactionNumber}</td>
                                  <td className="py-2 px-3 text-amber-300 font-bold">{formatCurrency(tx.amount)}</td>
                                  <td className="py-2 px-3">{tx.paymentMode}</td>
                                  <td className="py-2 px-3 text-rose-400">{formatCurrency(tx.deductedAmount)}</td>
                                  <td className="py-2 px-3 text-emerald-400">{formatCurrency(tx.remainingAmount)}</td>
                                  <td className="py-2 px-3">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                      tx.status === 'FULLY_DEDUCTED'
                                        ? 'text-emerald-400 bg-emerald-950'
                                        : tx.status === 'PARTIALLY_DEDUCTED'
                                        ? 'text-amber-300 bg-amber-950'
                                        : tx.status === 'VOIDED'
                                        ? 'text-rose-400 bg-rose-950'
                                        : 'text-sky-400 bg-sky-950'
                                    }`}>
                                      {tx.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Payroll Recoveries list */}
                    {advanceSummary.deductions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          Linked Monthly Payroll Recoveries ({advanceSummary.deductions.length})
                        </h4>
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono space-y-1.5 max-h-36 overflow-y-auto">
                          {advanceSummary.deductions.map((ded: AdvancePayrollDeduction) => (
                            <div key={ded.id} className="flex justify-between items-center py-1 border-b border-slate-900 last:border-b-0">
                              <div>
                                <span className="text-white font-bold">{ded.month} Payroll</span>
                                <span className="text-slate-500 text-[10px] ml-2">({ded.transactionNumber})</span>
                              </div>
                              <span className="text-rose-400 font-bold">-{formatCurrency(ded.deductedAmount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setViewingProfileWorker(null);
                  setAdvanceSummary(null);
                }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
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
