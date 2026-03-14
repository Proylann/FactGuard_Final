import { Plus, X } from 'lucide-react';
import { cardClass, inputClass, primaryButtonClass, ModalBackdrop } from './shared';

type UserRole = 'admin' | 'staff' | 'user';

export interface UserFormData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
}

const UserEditModal = ({
  mode,
  form,
  onChange,
  onSubmit,
  onClose,
  message,
  error,
}: {
  mode: 'create' | 'edit';
  form: UserFormData;
  onChange: (form: UserFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
  message: string | null;
  error: string | null;
}) => (
  <ModalBackdrop onClose={onClose}>
    <div className={`${cardClass} relative`}>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">
            {mode === 'create' ? 'Add New User' : 'Edit User'}
          </h3>
          <p className="text-sm font-medium text-slate-500">
            {mode === 'create' ? 'Create a new account with role and status.' : 'Update user details and permissions.'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
        >
          <X size={16} />
        </button>
      </div>

      {/* Form */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Username</label>
          <input
            value={form.username}
            onChange={(e) => onChange({ ...form, username: e.target.value })}
            placeholder="Enter username"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
          <input
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            placeholder="Enter email address"
            type="email"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
            {mode === 'create' ? 'Password' : 'New Password (optional)'}
          </label>
          <input
            value={form.password}
            onChange={(e) => onChange({ ...form, password: e.target.value })}
            placeholder={mode === 'create' ? 'Enter password' : 'Leave blank to keep current'}
            type="password"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Role</label>
          <select
            value={form.role}
            onChange={(e) => onChange({ ...form, role: e.target.value as UserRole })}
            className={inputClass}
          >
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="user">User</option>
          </select>
        </div>
        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-bold text-slate-700">Active status</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => onChange({ ...form, is_active: e.target.checked })}
              className="peer sr-only"
            />
            <div className="h-6 w-11 cursor-pointer rounded-full bg-slate-300 transition peer-checked:bg-emerald-500" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 cursor-pointer rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </div>
        </label>

        {message && (
          <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">{message}</div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onSubmit} className={`${primaryButtonClass} flex-1`}>
            <Plus size={16} />
            {mode === 'create' ? 'Add User' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  </ModalBackdrop>
);

export default UserEditModal;
