import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { AdminLog } from '../../components/main/types';
import { cardClass, inputClass, secondaryButtonClass, formatDate } from './sharedStyles';

const ITEMS_PER_PAGE = 15;

const ActivityLogView = ({ logs }: { logs: AdminLog[] }) => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'info' | 'success' | 'error'>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return logs.filter((log) => {
      const matchQ = `${log.message} ${log.username || ''} ${log.action}`.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || log.type === typeFilter;
      return matchQ && matchType;
    });
  }, [logs, query, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const typeColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700',
    success: 'bg-emerald-100 text-emerald-700',
    error: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className={cardClass}>
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">Activity Log</h3>
          <p className="text-sm font-medium text-slate-500">{filtered.length} log entr{filtered.length !== 1 ? 'ies' : 'y'} found</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search activity logs…"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-slate-900 focus:bg-white"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as 'all' | 'info' | 'success' | 'error'); setPage(1); }}
          className={inputClass}
        >
          <option value="all">All types</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-black uppercase tracking-wider text-slate-500">
              <th className="py-3 pr-4">Message</th>
              <th className="py-3 pr-4">User</th>
              <th className="py-3 pr-4">Type</th>
              <th className="py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((log) => (
              <tr key={log.log_id} className="border-b border-slate-100 transition hover:bg-slate-50/50">
                <td className="py-4 pr-4">
                  <p className="text-sm font-bold text-slate-900">{log.message}</p>
                  {log.action && <p className="text-xs font-semibold text-slate-500">{log.action}</p>}
                </td>
                <td className="py-4 pr-4 text-sm font-semibold text-slate-600">{log.username || 'System'}</td>
                <td className="py-4 pr-4">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${typeColors[log.type] || 'bg-slate-100 text-slate-600'}`}>
                    {log.type}
                  </span>
                </td>
                <td className="py-4 text-sm font-semibold text-slate-600">{formatDate(log.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {paginated.length === 0 && <p className="py-8 text-center text-sm font-semibold text-slate-400">No activity logs match the current filters.</p>}
      </div>

      {/* Pagination */}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}>Previous</button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}>Next</button>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogView;
