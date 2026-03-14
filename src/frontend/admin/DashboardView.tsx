import { Activity } from 'lucide-react';
import type { AdminOverview } from '../../components/main/types';
import { cardClass, ChartBars, DonutLegend, formatDate } from './shared';

const DashboardView = ({ overview }: { overview: AdminOverview | null }) => (
  <div className="space-y-6">
    {/* Stat Cards */}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Total Users', value: overview?.total_users ?? 0, color: 'from-slate-900 to-slate-700' },
        { label: 'Total Records', value: overview?.total_records ?? 0, color: 'from-blue-600 to-blue-400' },
        { label: 'Approved', value: overview?.approved_requests ?? 0, color: 'from-emerald-600 to-emerald-400' },
        { label: 'Recent Activity', value: overview?.recent_activity.length ?? 0, color: 'from-violet-600 to-violet-400' },
      ].map((item) => (
        <div key={item.label} className={cardClass}>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{item.value}</p>
          <div className={`mt-4 h-1 w-16 rounded-full bg-gradient-to-r ${item.color}`} />
        </div>
      ))}
    </div>

    {/* Charts Row */}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
      <div className={cardClass}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900">System Usage</h3>
            <p className="text-sm font-medium text-slate-500">Record throughput over the last seven days.</p>
          </div>
          <Activity className="text-slate-400" size={18} />
        </div>
        <ChartBars labels={overview?.analytics.usage_labels ?? []} values={overview?.analytics.usage_counts ?? []} />
      </div>

      <div className={cardClass}>
        <DonutLegend
          title="Request Status"
          data={overview?.analytics.status_breakdown ?? { approved: 0, rejected: 0 }}
          colors={{ approved: 'bg-emerald-500', rejected: 'bg-rose-500' }}
        />
      </div>

      <div className={cardClass}>
        <DonutLegend
          title="Role Allocation"
          data={overview?.analytics.role_breakdown ?? { admin: 0, staff: 0, user: 0 }}
          colors={{ admin: 'bg-slate-900', staff: 'bg-sky-500', user: 'bg-violet-500' }}
        />
      </div>
    </div>

    {/* Recent Panels */}
    <div className="grid gap-6 xl:grid-cols-3">
      {/* Recent Users */}
      <div className={cardClass}>
        <h3 className="text-xl font-black text-slate-900">Recent Users</h3>
        <div className="mt-4 space-y-3">
          {(overview?.recent_users ?? []).map((user) => (
            <div key={user.user_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{user.username}</p>
                  <p className="text-xs font-semibold text-slate-500">{user.email}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  {user.role}
                </span>
              </div>
            </div>
          ))}
          {(overview?.recent_users ?? []).length === 0 && (
            <p className="py-4 text-center text-sm font-semibold text-slate-400">No recent users.</p>
          )}
        </div>
      </div>

      {/* Recent Records */}
      <div className={cardClass}>
        <h3 className="text-xl font-black text-slate-900">Recent Records</h3>
        <div className="mt-4 space-y-3">
          {(overview?.recent_records ?? []).map((record) => (
            <div key={record.scan_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{record.filename}</p>
                  <p className="text-xs font-semibold text-slate-500">{record.username} | {record.media_type}</p>
                </div>
                <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
                  {record.media_type}
                </span>
              </div>
            </div>
          ))}
          {(overview?.recent_records ?? []).length === 0 && (
            <p className="py-4 text-center text-sm font-semibold text-slate-400">No recent records.</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className={cardClass}>
        <h3 className="text-xl font-black text-slate-900">Recent Activity</h3>
        <div className="mt-4 space-y-3">
          {(overview?.recent_activity ?? []).slice(0, 5).map((log) => (
            <div key={log.log_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100">
              <p className="text-sm font-black text-slate-900">{log.message}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {log.username || 'System'} | {formatDate(log.timestamp)}
              </p>
            </div>
          ))}
          {(overview?.recent_activity ?? []).length === 0 && (
            <p className="py-4 text-center text-sm font-semibold text-slate-400">No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default DashboardView;
