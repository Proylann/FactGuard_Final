import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, Download, FileBarChart, XCircle } from 'lucide-react';
import type { AdminReportSummary } from '../../components/main/types';
import { cardClass, inputClass, secondaryButtonClass, primaryButtonClass, downloadBlob } from './sharedStyles';
import { getAuthToken } from '../../components/main/helpers';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
type ExportFormat = 'pdf' | 'excel' | 'csv';
const DEFAULT_REPORT_RANGE = (() => {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 6);
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: now.toISOString().slice(0, 10),
  };
})();

const ReportsView = () => {
  const [reportRange, setReportRange] = useState(DEFAULT_REPORT_RANGE);
  const [summary, setSummary] = useState<AdminReportSummary | null>(null);

  const fetchSummary = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    const params = new URLSearchParams(reportRange);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSummary(await res.json());
    } catch { /* ignore */ }
  }, [reportRange]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchSummary();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [fetchSummary]);

  const handleDownload = async (format: ExportFormat) => {
    const params = new URLSearchParams({
      export_format: format,
      date_from: reportRange.date_from,
      date_to: reportRange.date_to,
    });
    try {
      const ext = format === 'excel' ? 'xls' : format;
      await downloadBlob(`${API_BASE}/api/admin/reports/download?${params.toString()}`, `factguard_report.${ext}`);
    } catch {
      window.alert(`Failed to download ${format.toUpperCase()} report.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className={cardClass}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900">Generate Reports</h3>
            <p className="text-sm font-medium text-slate-500">Filter by date range and download printable reports.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input type="date" value={reportRange.date_from} onChange={(e) => setReportRange((prev) => ({ ...prev, date_from: e.target.value }))} className={inputClass} />
            <input type="date" value={reportRange.date_to} onChange={(e) => setReportRange((prev) => ({ ...prev, date_to: e.target.value }))} className={inputClass} />
            <button onClick={() => void fetchSummary()} className={primaryButtonClass}>Generate</button>
            <div className="flex gap-2">
              <button onClick={() => void handleDownload('pdf')} className={secondaryButtonClass}><Download size={14} />PDF</button>
              <button onClick={() => void handleDownload('csv')} className={secondaryButtonClass}><Download size={14} />CSV</button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Records', value: summary?.total_records ?? 0, icon: Activity },
          { label: 'Approved', value: summary?.approved_requests ?? 0, icon: CheckCircle2 },
          { label: 'Rejected', value: summary?.rejected_requests ?? 0, icon: XCircle },
          { label: 'Avg. Confidence', value: `${summary?.average_confidence ?? 0}%`, icon: FileBarChart },
        ].map((item) => (
          <div key={item.label} className={cardClass}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
              <item.icon size={16} className="text-slate-400" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Report Data */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className={cardClass}>
          <h3 className="text-xl font-black text-slate-900">Report Statistics</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Synthetic Records</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{summary?.synthetic_records ?? 0}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Authentic Records</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{summary?.authentic_records ?? 0}</p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 pr-4">Record</th>
                  <th className="py-3 pr-4">Owner</th>
                  <th className="py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.records ?? []).map((record) => (
                  <tr key={record.scan_id} className="border-b border-slate-100 transition hover:bg-slate-50/50">
                    <td className="py-4 pr-4 text-sm font-black text-slate-900">{record.filename}</td>
                    <td className="py-4 pr-4 text-sm font-semibold text-slate-600">{record.username}</td>
                    <td className="py-4 text-sm font-bold text-slate-700">{record.confidence_score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardClass}>
          <h3 className="text-xl font-black text-slate-900">Printable Summary</h3>
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-600">Range</p>
            <p className="mt-1 text-lg font-black text-slate-900">{reportRange.date_from} to {reportRange.date_to}</p>
            <div className="mt-5 space-y-3 text-sm font-semibold text-slate-600">
              <p>Total records reviewed: <span className="font-black text-slate-900">{summary?.total_records ?? 0}</span></p>
              <p>Approved decisions: <span className="font-black text-slate-900">{summary?.approved_requests ?? 0}</span></p>
              <p>Rejected decisions: <span className="font-black text-slate-900">{summary?.rejected_requests ?? 0}</span></p>
              <p>Average confidence: <span className="font-black text-slate-900">{summary?.average_confidence ?? 0}%</span></p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => void handleDownload('pdf')} className={primaryButtonClass}><Download size={14} />Download PDF</button>
            <button onClick={() => void handleDownload('excel')} className={secondaryButtonClass}><Download size={14} />Excel</button>
            <button onClick={() => void handleDownload('csv')} className={secondaryButtonClass}><Download size={14} />CSV</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
