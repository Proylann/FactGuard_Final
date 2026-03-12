import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { getAuthToken, getStoredSession } from '../components/main/helpers';
import type { AdminLog, AdminOverview, AdminScan, AdminUser } from '../components/main/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

type AdminView = 'overview' | 'users' | 'analyzed' | 'logs';

const NAV_ITEMS: Array<{
  id: AdminView;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'analyzed', label: 'Analyzed', icon: Activity },
  { id: 'logs', label: 'Logs', icon: UserCog },
];

const cardClass = 'rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.45)]';

const Sidebar = ({
  currentView,
  onChangeView,
  adminName,
  onLogout,
}: {
  currentView: AdminView;
  onChangeView: (view: AdminView) => void;
  adminName: string;
  onLogout: () => void;
}) => (
  <aside className="h-full rounded-[24px] border-r border-slate-200 bg-slate-50 p-4 md:p-5 flex flex-col">
    <div className="flex items-center gap-3 px-2 pb-5 border-b border-slate-200">
      <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
        <Shield size={20} />
      </div>
      <div>
        <p className="text-xl font-black text-slate-900 tracking-tight">FactGuard</p>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Admin Panel</p>
      </div>
    </div>

    <div className="space-y-2 mt-5">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => onChangeView(item.id)}
          className={`w-full inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
            currentView === item.id
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span className={`h-6 w-6 rounded-md flex items-center justify-center ${currentView === item.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <item.icon size={14} />
          </span>
          {item.label}
        </button>
      ))}
    </div>

    <div className="mt-auto space-y-3 pt-5">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black">
          {adminName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-700 truncate">{adminName}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Administrator</p>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
      >
        <LogOut size={16} />
        Logout
      </button>
    </div>
  </aside>
);

const AdminPanel = ({ onLogout }: { onLogout: () => void }) => {
  const [currentView, setCurrentView] = useState<AdminView>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [scans, setScans] = useState<AdminScan[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [scanQuery, setScanQuery] = useState('');
  const [logQuery, setLogQuery] = useState('');
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '' });
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('FactGuard Admin');

  useEffect(() => {
    const session = getStoredSession();
    if (session?.username) setAdminName(String(session.username));
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          onLogout();
          return;
        }
        const res = await fetch(`${API_BASE}/api/admin/session/validate`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) onLogout();
      } catch {
        onLogout();
      }
    };
    void verifySession();
  }, [onLogout]);

  const refreshData = useEffectEvent(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const [overviewRes, usersRes, scansRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/overview`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/admin/scans`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/admin/logs`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (scansRes.ok) setScans(await scansRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch {
      // Keep admin workspace usable during backend interruptions.
    }
  });

  useEffect(() => {
    void refreshData();
    const interval = setInterval(() => {
      void refreshData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        `${user.username} ${user.email}`.toLowerCase().includes(userQuery.toLowerCase()),
      ),
    [users, userQuery],
  );

  const filteredScans = useMemo(
    () =>
      scans.filter((scan) =>
        `${scan.filename} ${scan.username} ${scan.email} ${scan.media_type}`.toLowerCase().includes(scanQuery.toLowerCase()),
      ),
    [scans, scanQuery],
  );

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) =>
        `${log.action} ${log.message} ${log.username || ''} ${log.email || ''}`.toLowerCase().includes(logQuery.toLowerCase()),
      ),
    [logs, logQuery],
  );

  const resetForm = () => {
    setFormMode('create');
    setEditingUserId(null);
    setUserForm({ username: '', email: '', password: '' });
  };

  const handleSubmitUser = async () => {
    setFormError(null);
    setFormMessage(null);
    const token = getAuthToken();
    if (!token) return;

    try {
      const endpoint = formMode === 'create' ? `${API_BASE}/api/admin/users` : `${API_BASE}/api/admin/users/${editingUserId}`;
      const method = formMode === 'create' ? 'POST' : 'PATCH';
      const payload =
        formMode === 'create'
          ? userForm
          : {
              username: userForm.username,
              email: userForm.email,
              ...(userForm.password ? { password: userForm.password } : {}),
            };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.detail || data.message || 'Request failed.');
        return;
      }
      setFormMessage(formMode === 'create' ? 'User created.' : 'User updated.');
      resetForm();
      await refreshData();
    } catch {
      setFormError('Request failed.');
    }
  };

  const handleEditUser = (user: AdminUser) => {
    setFormMode('edit');
    setEditingUserId(user.user_id);
    setUserForm({ username: user.username, email: user.email, password: '' });
    setCurrentView('users');
    setFormError(null);
    setFormMessage(null);
  };

  const handleDeleteUser = async (userId: number) => {
    const confirmed = window.confirm('Delete this user and all of their scans and logs?');
    if (!confirmed) return;
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      await refreshData();
    } catch {
      window.alert('Failed to delete user.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900">
      <main className="w-full min-h-screen bg-white overflow-hidden">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Sidebar currentView={currentView} onChangeView={setCurrentView} adminName={adminName} onLogout={onLogout} />

          <section className="p-5 md:p-8">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900">
                  {currentView === 'overview' ? 'Admin Overview' : currentView === 'users' ? 'User Management' : currentView === 'analyzed' ? 'Analyzed Records' : 'System Logs'}
                </h1>
                <p className="mt-1 text-sm md:text-base font-medium text-slate-500">
                  Administrative workspace for user operations, fleet-wide scans, and audit visibility.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Access</p>
                <p className="text-sm font-bold text-slate-700">{adminName}</p>
              </div>
            </div>

            {currentView === 'overview' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    { label: 'Users', value: overview?.total_users ?? 0 },
                    { label: 'All Scans', value: overview?.total_scans ?? 0 },
                    { label: 'Flagged', value: overview?.synthetic_scans ?? 0 },
                    { label: 'Authentic', value: overview?.authentic_scans ?? 0 },
                    { label: 'Logs', value: overview?.total_logs ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className={cardClass}>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                      <p className="mt-3 text-3xl font-black text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className={cardClass}>
                    <h3 className="text-xl font-black text-slate-900">Recent Users</h3>
                    <div className="mt-4 space-y-3">
                      {(overview?.recent_users || []).map((user) => (
                        <div key={user.user_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-sm font-bold text-slate-900">{user.username}</p>
                          <p className="text-xs font-semibold text-slate-500">{user.email}</p>
                        </div>
                      ))}
                      {(overview?.recent_users || []).length === 0 && <p className="text-sm font-semibold text-slate-400">No users found.</p>}
                    </div>
                  </div>

                  <div className={cardClass}>
                    <h3 className="text-xl font-black text-slate-900">Recent System Scans</h3>
                    <div className="mt-4 space-y-3">
                      {(overview?.recent_scans || []).map((scan) => (
                        <div key={scan.scan_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{scan.filename}</p>
                              <p className="text-xs font-semibold text-slate-500">{scan.username} • {scan.email}</p>
                            </div>
                            <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ${scan.is_synthetic ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {scan.is_synthetic ? 'Flagged' : 'Authentic'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {(overview?.recent_scans || []).length === 0 && <p className="text-sm font-semibold text-slate-400">No scans recorded.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentView === 'users' && (
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className={cardClass}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-black text-slate-900">{formMode === 'create' ? 'Create User' : 'Edit User'}</h3>
                    {formMode === 'edit' && (
                      <button onClick={resetForm} className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Cancel
                      </button>
                    )}
                  </div>
                  <div className="mt-5 space-y-3">
                    <input
                      value={userForm.username}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
                      placeholder="Username"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none"
                    />
                    <input
                      value={userForm.email}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Email"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none"
                    />
                    <input
                      value={userForm.password}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder={formMode === 'create' ? 'Password' : 'New password (optional)'}
                      type="password"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none"
                    />
                    {formMessage && <p className="text-sm font-bold text-emerald-600">{formMessage}</p>}
                    {formError && <p className="text-sm font-bold text-rose-600">{formError}</p>}
                    <button
                      onClick={() => void handleSubmitUser()}
                      className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-700"
                    >
                      {formMode === 'create' ? 'Create User' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                <div className={cardClass}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-xl font-black text-slate-900">Registered Users</h3>
                    <div className="relative w-full md:w-80">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder="Search users"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                          <th className="py-3 pr-4 font-black">User</th>
                          <th className="py-3 pr-4 font-black">Scans</th>
                          <th className="py-3 pr-4 font-black">Flagged</th>
                          <th className="py-3 font-black">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr key={user.user_id} className="border-b border-slate-100">
                            <td className="py-4 pr-4">
                              <p className="text-sm font-bold text-slate-900">{user.username}</p>
                              <p className="text-xs font-semibold text-slate-500">{user.email}</p>
                            </td>
                            <td className="py-4 pr-4 text-sm font-bold text-slate-700">{user.total_scans}</td>
                            <td className="py-4 pr-4 text-sm font-bold text-slate-700">{user.flagged_scans}</td>
                            <td className="py-4">
                              <div className="flex gap-2">
                                <button onClick={() => handleEditUser(user)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                                  Edit
                                </button>
                                <button onClick={() => void handleDeleteUser(user.user_id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50">
                                  <span className="inline-flex items-center gap-1"><Trash2 size={12} /> Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-sm font-semibold text-slate-400">
                              No users match the current search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {currentView === 'analyzed' && (
              <div className={cardClass}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-xl font-black text-slate-900">All Analyzed Records</h3>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={scanQuery}
                      onChange={(e) => setScanQuery(e.target.value)}
                      placeholder="Search scans"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium outline-none"
                    />
                  </div>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {filteredScans.map((scan) => (
                    <motion.div key={scan.scan_id} layout className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">{scan.filename}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{scan.username} • {scan.email}</p>
                        </div>
                        <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ${scan.is_synthetic ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {scan.is_synthetic ? 'Flagged' : 'Authentic'}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                        <span className="rounded-full bg-white px-3 py-1">{scan.media_type}</span>
                        <span className="rounded-full bg-white px-3 py-1">{scan.confidence_score}% confidence</span>
                        <span className="rounded-full bg-white px-3 py-1">{new Date(scan.created_at).toLocaleString()}</span>
                      </div>
                      <div className="mt-4 space-y-2">
                        {scan.artifacts.slice(0, 3).map((artifact, index) => (
                          <div key={`${scan.scan_id}-${index}`} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                            {artifact}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                  {filteredScans.length === 0 && <p className="text-sm font-semibold text-slate-400">No scans match the current search.</p>}
                </div>
              </div>
            )}

            {currentView === 'logs' && (
              <div className={cardClass}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-xl font-black text-slate-900">Platform Audit Logs</h3>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={logQuery}
                      onChange={(e) => setLogQuery(e.target.value)}
                      placeholder="Search logs"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium outline-none"
                    />
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {filteredLogs.map((log) => (
                    <div key={log.log_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="inline-flex items-center gap-2">
                            {log.type === 'error' && <AlertTriangle size={14} className="text-rose-600" />}
                            <p className="text-sm font-black text-slate-900">{log.message}</p>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {log.username || 'System'} {log.email ? `• ${log.email}` : ''} {log.ip_address ? `• ${log.ip_address}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{log.action}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredLogs.length === 0 && <p className="text-sm font-semibold text-slate-400">No logs match the current search.</p>}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
