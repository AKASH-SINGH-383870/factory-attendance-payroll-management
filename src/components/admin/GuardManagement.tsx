import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Edit3,
  KeyRound,
  CheckCircle,
  XCircle,
  Phone,
  Building,
  Lock,
  X,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { GuardUser } from '../../types';
import { StorageService } from '../../services/storage';
import { ApiService } from '../../services/api';

interface GuardManagementProps {
  onDataChanged: () => void;
}

export const GuardManagement: React.FC<GuardManagementProps> = ({ onDataChanged }) => {
  const [guards, setGuards] = useState<GuardUser[]>(StorageService.getGuards());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<GuardUser | null>(null);

  // Password reset modal state
  const [resetModalGuard, setResetModalGuard] = useState<GuardUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Form State
  const [formData, setFormData] = useState<{
    guardId: string;
    fullName: string;
    mobile: string;
    username: string;
    password: string;
    gateAssigned: string;
    factoryLocation: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    guardId: '',
    fullName: '',
    mobile: '',
    username: '',
    password: '',
    gateAssigned: 'Gate 1 – Main Gate North',
    factoryLocation: 'Plant A – Main Manufacturing Complex',
    status: 'ACTIVE',
  });

  const refreshGuards = async () => {
    try {
      const data = await ApiService.getGuards();
      setGuards(data);
    } catch {
      setGuards(StorageService.getGuards());
    }
    onDataChanged();
  };

  React.useEffect(() => {
    refreshGuards();
  }, []);

  const handleOpenAdd = () => {
    const nextNum = guards.length + 1;
    const nextCode = `G-10${nextNum}`;
    setEditingGuard(null);
    setFormData({
      guardId: nextCode,
      fullName: '',
      mobile: '+91 ',
      username: `guard0${nextNum}`,
      password: 'guard123',
      gateAssigned: `Gate ${nextNum} – Entry Gate`,
      factoryLocation: 'Plant Complex A – Manufacturing Unit',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (guard: GuardUser) => {
    setEditingGuard(guard);
    setFormData({
      guardId: guard.guardId,
      fullName: guard.fullName,
      mobile: guard.mobile,
      username: guard.username,
      password: guard.passwordHash,
      gateAssigned: guard.gateAssigned,
      factoryLocation: guard.factoryLocation,
      status: guard.status,
    });
    setIsModalOpen(true);
  };

  const handleSaveGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.username.trim()) return;

    const guardToSave: GuardUser = {
      id: editingGuard ? editingGuard.id : 'guard-' + Date.now(),
      guardId: formData.guardId.trim().toUpperCase(),
      fullName: formData.fullName.trim(),
      mobile: formData.mobile.trim(),
      username: formData.username.trim().toLowerCase(),
      passwordHash: formData.password.trim() || 'guard123',
      gateAssigned: formData.gateAssigned.trim(),
      factoryLocation: formData.factoryLocation.trim(),
      status: formData.status,
      createdAt: editingGuard ? editingGuard.createdAt : new Date().toISOString(),
      lastLogin: editingGuard?.lastLogin,
    };

    if (editingGuard) {
      await ApiService.updateGuard(editingGuard.id, guardToSave);
    } else {
      await ApiService.createGuard(guardToSave);
    }
    setIsModalOpen(false);
    refreshGuards();
  };

  const handleToggleStatus = async (guardId: string) => {
    await ApiService.toggleGuardStatus(guardId);
    refreshGuards();
  };

  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalGuard || !newPasswordInput.trim()) return;

    await ApiService.updateGuard(resetModalGuard.id, {
      passwordHash: newPasswordInput.trim(),
    });
    setResetModalGuard(null);
    setNewPasswordInput('');
    refreshGuards();
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Security Guard User Management</h2>
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono px-2 py-0.5 rounded-full">
              {guards.filter(g => g.status === 'ACTIVE').length} Active Guards
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Create gate credentials, assign factory security gates, and manage guard access.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Security Guard</span>
        </button>
      </div>

      {/* Security Guards Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {guards.map(guard => (
          <div
            key={guard.id}
            className={`bg-slate-900 border rounded-2xl p-5 shadow-lg relative flex flex-col justify-between transition-all ${
              guard.status === 'ACTIVE' ? 'border-slate-800 hover:border-slate-700' : 'border-rose-900/50 opacity-75'
            }`}
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl border ${
                    guard.status === 'ACTIVE' 
                      ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-400' 
                      : 'bg-rose-950/70 border-rose-700/60 text-rose-400'
                  }`}>
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">
                      {guard.fullName}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      ID: {guard.guardId}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleStatus(guard.id)}
                  className={`text-xs px-2.5 py-1 rounded-full font-bold cursor-pointer transition-colors ${
                    guard.status === 'ACTIVE'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900'
                      : 'bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900'
                  }`}
                  title="Click to toggle status"
                >
                  {guard.status}
                </button>
              </div>

              {/* Details List */}
              <div className="mt-4 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" /> Assigned Gate:
                  </span>
                  <span className="font-semibold text-white">{guard.gateAssigned}</span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> Mobile:
                  </span>
                  <span className="font-mono text-slate-300">{guard.mobile}</span>
                </div>

                <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Gate Login:
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {guard.username}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => {
                  setResetModalGuard(guard);
                  setNewPasswordInput('guard123');
                }}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" /> Reset Password
              </button>

              <button
                onClick={() => handleOpenEdit(guard)}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Profile
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================= */}
      {/* ADD / EDIT GUARD MODAL                                    */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">
                {editingGuard ? `Edit Guard: ${editingGuard.fullName}` : 'Register New Security Guard'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGuard} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Guard Badge ID *
                </label>
                <input
                  type="text"
                  required
                  value={formData.guardId}
                  onChange={e => setFormData({ ...formData, guardId: e.target.value })}
                  placeholder="G-101"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500 uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Username (Login) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    placeholder="guard01"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Password *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="guard123"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Assigned Factory Gate *
                </label>
                <input
                  type="text"
                  required
                  value={formData.gateAssigned}
                  onChange={e => setFormData({ ...formData, gateAssigned: e.target.value })}
                  placeholder="Gate 1 – Main Gate North"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                >
                  <option value="ACTIVE">ACTIVE (Authorized to operate gate)</option>
                  <option value="INACTIVE">INACTIVE (Access blocked)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
                >
                  {editingGuard ? 'Save Changes' : 'Create Guard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RESET PASSWORD MODAL                                      */}
      {/* ========================================================= */}
      {resetModalGuard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 text-white space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-950 text-amber-400 border border-amber-800">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Reset Guard Password</h3>
                <p className="text-xs text-slate-400">{resetModalGuard.fullName} ({resetModalGuard.username})</p>
              </div>
            </div>

            <form onSubmit={handleExecutePasswordReset} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  New Password
                </label>
                <input
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalGuard(null)}
                  className="px-3 py-1.5 border border-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
