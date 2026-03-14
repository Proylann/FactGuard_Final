import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, PencilLine, Plus, Search, Trash2, X } from 'lucide-react';
import type { AdminScan } from '../../components/main/types';
import { cardClass, inputClass, secondaryButtonClass, primaryButtonClass, dangerButtonClass, formatDate, downloadBlob } from './shared';
import RecordEditModal, { type RecordFormData } from './RecordEditModal';
import { getAuthToken } from '../../components/main/helpers';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
type ExportFormat = 'pdf' | 'excel' | 'csv';

const RecordsView = ({
  records,
  onRefresh,
}: {
  records: AdminScan[];
  onRefresh: () => Promise<void>;
}) => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'text'>('all');
  const [page, setPage] = useState(1);
  const perPage = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedRecord, setSelectedRecord] = useState<AdminScan | null>(null);
  const [viewRecord, setViewRecord] = useState<AdminScan | null>(null);
  const [form, setForm] = useState<RecordFormData>({
    user_id: '',
    filename: '',
    media_type: 'image',
    confidence_score: '50',
    is_synthetic: false,
    artifacts: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return records.filter((r) => {
      const matchQ = `${r.filename} ${r.username} ${r.email} ${r.media_type}`.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || r.media_type === typeFilter;
      return matchQ && matchType;
    });
  }, [records, query, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [query, typeFilter]);

  const openCreate = () => {
    setModalMode('create');
    setForm({ user_id: '', filename: '', media_type: 'image', confidence_score: '50', is_synthetic: false, artifacts: '' });
    setSelectedRecord(null);
    setMessage(null);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (record: AdminScan) => {
    setModalMode('edit');
    setSelectedRecord(record);
    setForm({
      user_id: String(record.user_id),
      filename: record.filename,
      media_type: record.media_type as 'image' | 'video' | 'text',
      confidence_score: String(record.confidence_score),
      is_synthetic: record.is_synthetic,
      artifacts: record.artifacts.join('\n'),
    });
    setMessage(null);
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedRecord(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    const token = getAuthToken();
    if (!token) return;
    const payload = {
      user_id: Number(form.user_id),
      filename: form.filename.trim(),
      media_type: form.media_type,
      confidence_score: Number(form.confidence_score),
      is_synthetic: form.is_synthetic,
      artifacts: form.artifacts.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    try {
      const endpoint = modalMode === 'create'
        ? `${API_BASE}/api/admin/records`
        : `${API_BASE}/api/admin/records/${selectedRecord?.scan_id}`;
      const method = modalMode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || 'Unable to save record.');
        return;
      }
      setMessage(modalMode === 'create' ? 'Record created.' : 'Record updated.');
      await onRefresh();
      setTimeout(() => closeModal(), 1200);
    } catch {
      setError('Unable to save record.');
    }
  };

  const handleDelete = async (recordId: number) => {
    if (!window.confirm('Delete this record?')) return;
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/records/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      await onRefresh();
    } catch {
      window.alert('Failed to delete record.');
    }
  };

  const handleExport = async (format: ExportFormat) => {
    try {
      const ext = format === 'excel' ? 'xls' : format;
      await downloadBlob(`${API_BASE}/api/admin/records/export?export_format=${format}`, `factguard_records.${ext}`);
    } catch {
      window.alert(`Failed to export ${format.toUpperCase()}.`);
    }
  };

  return (
    <>
      <div className={cardClass}>
        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900">All Records</h3>
            <p className="text-sm font-medium text-slate-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''} found</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void handleExport('pdf')} className={secondaryButtonClass}><Download size={14} />PDF</button>
            <button onClick={() => void handleExport('excel')} className={secondaryButtonClass}><Download size={14} />Excel</button>
            <button onClick={() => void handleExport('csv')} className={secondaryButtonClass}><Download size={14} />CSV</button>
            <button onClick={openCreate} className={primaryButtonClass}><Plus size={16} />Add Record</button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search records…" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-slate-900 focus:bg-white" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | 'image' | 'video' | 'text')} className={inputClass}>
            <option value="all">All types</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="text">Text</option>
          </select>
        </div>

        {/* Table */}
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 pr-4">Record</th>
                <th className="py-3 pr-4">Owner</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Confidence</th>
                <th className="py-3 pr-4">Synthetic</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((record) => (
                <tr key={record.scan_id} className="border-b border-slate-100 align-top transition hover:bg-slate-50/50">
                  <td className="py-4 pr-4">
                    <p className="text-sm font-black text-slate-900">{record.filename}</p>
                    <p className="text-xs font-semibold text-slate-500">{formatDate(record.created_at)}</p>
                  </td>
                  <td className="py-4 pr-4">
                    <p className="text-sm font-bold text-slate-700">{record.username}</p>
                    <p className="text-xs font-semibold text-slate-500">{record.email}</p>
                  </td>
                  <td className="py-4 pr-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
                      {record.media_type}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-slate-200">
                        <div className={`h-1.5 rounded-full ${record.confidence_score >= 70 ? 'bg-emerald-500' : record.confidence_score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${record.confidence_score}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{record.confidence_score}%</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${record.is_synthetic ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {record.is_synthetic ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setViewRecord(record)} className={secondaryButtonClass} title="View"><Eye size={14} /></button>
                      <button onClick={() => openEdit(record)} className={secondaryButtonClass} title="Edit"><PencilLine size={14} /></button>
                      <button onClick={() => void handleDelete(record.scan_id)} className={dangerButtonClass} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginated.length === 0 && <p className="py-8 text-center text-sm font-semibold text-slate-400">No records match the current filters.</p>}
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

      {/* View Record Detail */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={(e) => { if (e.target === e.currentTarget) setViewRecord(null); }}>
          <div className={`${cardClass} relative mx-4 w-full max-w-md animate-[scaleIn_0.25s_ease-out]`}>
            <button onClick={() => setViewRecord(null)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
              <X size={14} />
            </button>
            <h3 className="text-xl font-black text-slate-900 mb-4">Record Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Filename', value: viewRecord.filename },
                { label: 'Owner', value: viewRecord.username },
                { label: 'Type', value: viewRecord.media_type },
                { label: 'Confidence', value: `${viewRecord.confidence_score}%` },
                { label: 'Synthetic', value: viewRecord.is_synthetic ? 'Yes' : 'No' },
                { label: 'Created', value: formatDate(viewRecord.created_at) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
            {viewRecord.artifacts.length > 0 && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Artifacts</p>
                <ul className="mt-1 space-y-0.5">
                  {viewRecord.artifacts.map((a, i) => (
                    <li key={i} className="text-sm font-semibold text-slate-700">• {a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <RecordEditModal
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

export default RecordsView;
