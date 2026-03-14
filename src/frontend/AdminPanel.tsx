import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { getAuthToken, getStoredSession } from '../components/main/helpers';
import type { AdminLog, AdminOverview, AdminScan, AdminUser } from '../components/main/types';
import Sidebar, { type AdminView } from './admin/Sidebar';
import DashboardView from './admin/DashboardView';
import UserManagementView from './admin/UserManagementView';
import RecordsView from './admin/RecordsView';
import ReportsView from './admin/ReportsView';
import ActivityLogView from './admin/ActivityLogView';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const VIEW_TITLES: Record<AdminView, { title: string; subtitle: string }> = {
  dashboard: { title: 'Admin Dashboard', subtitle: 'Platform analytics, account operations, and reporting overview.' },
  users: { title: 'User Management', subtitle: 'Manage accounts, roles, permissions, and access.' },
  records: { title: 'Records', subtitle: 'Browse, search, and manage all scan records.' },
  reports: { title: 'Reports', subtitle: 'Generate and export analytical reports.' },
  activity: { title: 'Activity Log', subtitle: 'Track all system and admin activity.' },
};

const AdminPanel = ({ onLogout }: { onLogout: () => void }) => {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [adminName, setAdminName] = useState('FactGuard Admin');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [records, setRecords] = useState<AdminScan[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.username) setAdminName(String(session.username));
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const token = getAuthToken();
        if (!token) { onLogout(); return; }
        const res = await fetch(`${API_BASE}/api/admin/session/validate`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) onLogout();
      } catch { onLogout(); }
    };
    void verifySession();
  }, [onLogout]);

  const fetchAdminData = useEffectEvent(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const [overviewRes, usersRes, recordsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/overview`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/admin/scans`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/admin/logs`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (recordsRes.ok) setRecords(await recordsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch { /* keep panel usable */ }
  });

  useEffect(() => {
    void fetchAdminData();
    const interval = setInterval(() => void fetchAdminData(), 30000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = useCallback(async () => {
    await fetchAdminData();
  }, [fetchAdminData]);

  const { title, subtitle } = VIEW_TITLES[currentView];

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900">
      <main className="min-h-screen w-full overflow-hidden bg-white">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Sidebar currentView={currentView} onChangeView={setCurrentView} adminName={adminName} onLogout={onLogout} />

          <section className="p-5 md:p-8">
            {/* Page Header */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{title}</h1>
                <p className="mt-1 text-sm font-medium text-slate-500 md:text-base">{subtitle}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Session</p>
                <p className="text-sm font-bold text-slate-700">{adminName}</p>
              </div>
            </div>

            {/* View Content */}
            {currentView === 'dashboard' && <DashboardView overview={overview} />}
            {currentView === 'users' && <UserManagementView users={users} onRefresh={refreshData} />}
            {currentView === 'records' && <RecordsView records={records} onRefresh={refreshData} />}
            {currentView === 'reports' && <ReportsView />}
            {currentView === 'activity' && <ActivityLogView logs={logs} />}
          </section>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
