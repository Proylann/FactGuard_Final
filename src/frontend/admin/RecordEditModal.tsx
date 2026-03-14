import { Plus, X } from 'lucide-react';
import { ModalBackdrop } from './shared';
import { cardClass, inputClass, primaryButtonClass } from './sharedStyles';

export interface RecordFormData {
  user_id: string;
  filename: string;
  media_type: 'image' | 'video' | 'text';
  confidence_score: string;
  is_synthetic: boolean;
  artifacts: string;
}

const RecordEditModal = ({
  mode,
  form,
  onChange,
  onSubmit,
  onClose,
  message,
  error,
}: {
  mode: 'create' | 'edit';
  form: RecordFormData;
  onChange: (form: RecordFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
  message: string | null;
  error: string | null;
}) => (
  <ModalBackdrop onClose={onClose}>
    <div className={`${cardClass} relative`}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">
            {mode === 'create' ? 'Add Record' : 'Edit Record'}
          </h3>
          <p className="text-sm font-medium text-slate-500">Manage record metadata and analysis details.</p>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">User ID</label>
            <input value={form.user_id} onChange={(e) => onChange({ ...form, user_id: e.target.value })} placeholder="User ID" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Media Type</label>
            <select value={form.media_type} onChange={(e) => onChange({ ...form, media_type: e.target.value as 'image' | 'video' | 'text' })} className={inputClass}>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="text">Text</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Filename</label>
          <input value={form.filename} onChange={(e) => onChange({ ...form, filename: e.target.value })} placeholder="Enter filename" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Confidence Score</label>
          <input value={form.confidence_score} onChange={(e) => onChange({ ...form, confidence_score: e.target.value })} placeholder="0–100" className={inputClass} />
        </div>
        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-bold text-slate-700">Mark as synthetic</span>
          <div className="relative">
            <input type="checkbox" checked={form.is_synthetic} onChange={(e) => onChange({ ...form, is_synthetic: e.target.checked })} className="peer sr-only" />
            <div className="h-6 w-11 cursor-pointer rounded-full bg-slate-300 transition peer-checked:bg-amber-500" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 cursor-pointer rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </div>
        </label>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Artifacts</label>
          <textarea value={form.artifacts} onChange={(e) => onChange({ ...form, artifacts: e.target.value })} placeholder="One per line" rows={3} className={inputClass} />
        </div>

        {message && <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">{message}</div>}
        {error && <div className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onSubmit} className={`${primaryButtonClass} flex-1`}>
            <Plus size={16} />
            {mode === 'create' ? 'Add Record' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  </ModalBackdrop>
);

export default RecordEditModal;
