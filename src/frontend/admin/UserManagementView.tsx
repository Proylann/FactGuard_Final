import { useMemo, useState } from 'react';
import { Eye, PencilLine, Plus, Search, Trash2, UserCog, X } from 'lucide-react';
import type { AdminUser } from '../../components/main/types';
import { cardClass, inputClass, secondaryButtonClass, primaryButtonClass, dangerButtonClass, formatDate } from './sharedStyles';
import UserEditModal, { type UserFormData } from './UserEditModal';
import { getAuthToken } from '../../components/main/helpers';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

type UserRole = 'admin' | 'staff' | 'user';

const UserManagementView = ({
  users,
  onRefresh,
}: {
  users: AdminUser[];
  onRefresh: () => Promise<void>;
}) => {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'name' | 'last_login' | 'role'>('name');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormData>({
    username: '',
    email: '',
    password: '',
    role: 'user',
    is_active: true,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = query.toLowerCase();
    return [...users]
      .filter((u) => {
        const matchQ = `${u.username} ${u.email}`.toLowerCase().includes(q);
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        const matchStatus = statusFilter === 'all' || u.status === statusFilter;
        return matchQ && matchRole && matchStatus;
      })
      .sort((a, b) => {
        if (sort === 'last_login') return (b.last_login || '').localeCompare(a.last_login || '');
        if (sort === 'role') return a.role.localeCompare(b.role);
        return a.username.localeCompare(b.username);
      });
  }, [users, query, roleFilter, statusFilter, sort]);

  const openCreate = () => {
    setModalMode('create');
    setForm({ username: '', email: '', password: '', role: 'user', is_active: true });
    setSelectedUser(null);
    setMessage(null);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setModalMode('edit');
    setSelectedUser(user);
    setForm({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active,
    });
    setMessage(null);
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedUser(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    const token = getAuthToken();
    if (!token) return;
    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      role: form.role,
      is_active: form.is_active,
      ...(form.password ? { password: form.password } : {}),
    };
    try {
      const endpoint = modalMode === 'create'
        ? `${API_BASE}/api/admin/users`
        : `${API_BASE}/api/admin/users/${selectedUser?.user_id}`;
      const method = modalMode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || 'Unable to save user.');
        return;
      }
      setMessage(modalMode === 'create' ? 'User created successfully.' : 'User updated successfully.');
      await onRefresh();
      setTimeout(() => closeModal(), 1200);
    } catch {
      setError('Unable to save user.');
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${user.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      if (!res.ok) throw new Error();
      await onRefresh();
    } catch {
      window.alert('Failed to update user status.');
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Delete this user and all related records?')) return;
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      await onRefresh();
    } catch {
      window.alert('Failed to delete user.');
    }
  };

  return (
    <>
      <div className={cardClass}>
        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900">All Users</h3>
            <p className="text-sm font-medium text-slate-500">
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <button onClick={openCreate} className={primaryButtonClass}>
            <Plus size={16} />
            Add User
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-slate-900 focus:bg-white"
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)} className={inputClass}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="user">User</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')} className={inputClass}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'last_login' | 'role')} className={inputClass}>
            <option value="name">Sort by name</option>
            <option value="last_login">Sort by last login</option>
            <option value="role">Sort by role</option>
          </select>
        </div>

        {/* Table */}
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 pr-4">User</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Last Login</th>
                <th className="py-3 pr-4">Scans</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.user_id} className="border-b border-slate-100 align-top transition hover:bg-slate-50/50">
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{user.username}</p>
                        <p className="text-xs font-semibold text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
                      user.role === 'admin'
                        ? 'bg-slate-900 text-white'
                        : user.role === 'staff'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-violet-100 text-violet-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
                      user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-sm font-semibold text-slate-600">{formatDate(user.last_login)}</td>
                  <td className="py-4 pr-4 text-sm font-bold text-slate-700">{user.total_scans}</td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setViewUser(user)} className={secondaryButtonClass} title="View">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openEdit(user)} className={secondaryButtonClass} title="Edit">
                        <PencilLine size={14} />
                      </button>
                      <button onClick={() => void handleToggleStatus(user)} className={secondaryButtonClass} title={user.is_active ? 'Deactivate' : 'Activate'}>
                        <UserCog size={14} />
                      </button>
                      <button onClick={() => void handleDelete(user.user_id)} className={dangerButtonClass} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <p className="py-8 text-center text-sm font-semibold text-slate-400">No users match the current filters.</p>
          )}
        </div>
      </div>

      {/* View User Detail Panel */}
      {viewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={(e) => { if (e.target === e.currentTarget) setViewUser(null); }}>
          <div className={`${cardClass} relative mx-4 w-full max-w-md animate-[scaleIn_0.25s_ease-out]`}>
            <button onClick={() => setViewUser(null)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
              <X size={14} />
            </button>
            <h3 className="text-xl font-black text-slate-900 mb-4">User Details</h3>
            <div className="flex items-center gap-4 mb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white">
                {viewUser.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">{viewUser.username}</p>
                <p className="text-sm font-semibold text-slate-500">{viewUser.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Role', value: viewUser.role },
                { label: 'Status', value: viewUser.status },
                { label: 'Total Scans', value: viewUser.total_scans },
                { label: 'Flagged Scans', value: viewUser.flagged_scans },
                { label: 'Last Login', value: formatDate(viewUser.last_login) },
                { label: 'Created', value: formatDate(viewUser.created_at) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-0.5 text-sm font-bold capitalize text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <UserEditModal
          mode={modalMode}
          form={form}
          onChange={setForm}
          onSubmit={() => void handleSubmit()}
          onClose={closeModal}
          message={message}
          error={error}
        />
      )}
    </>
  );
};

export default UserManagementView;
