import { getAuthToken } from '../../components/main/helpers';

// ── Shared CSS class constants ──────────────────────────────────────────────
export const cardClass =
  'rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_22px_60px_-32px_rgba(15,23,42,0.4)]';
export const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-900 focus:bg-white';
export const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition';
export const secondaryButtonClass = `${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
export const primaryButtonClass = `${buttonClass} bg-slate-900 text-white hover:bg-slate-700`;
export const dangerButtonClass = `${buttonClass} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`;

// ── Utilities ───────────────────────────────────────────────────────────────
export const formatDate = (value?: string | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString();
};

export const downloadBlob = async (url: string, filename: string) => {
  const token = getAuthToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
};

// ── Reusable Chart Bar Component ────────────────────────────────────────────
export const ChartBars = ({ labels, values }: { labels: string[]; values: number[] }) => {
  const maxValue = Math.max(...values, 1);
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex h-52 items-end gap-3">
        {values.map((value, index) => (
          <div key={`${labels[index]}-${index}`} className="flex flex-1 flex-col items-center gap-3">
            <div
              className="flex w-full items-end justify-center rounded-t-2xl bg-gradient-to-t from-slate-900 via-slate-700 to-slate-500 transition-all duration-500"
              style={{ height: `${Math.max((value / maxValue) * 100, 8)}%` }}
            >
              <span className="mb-2 text-[10px] font-black text-white">{value}</span>
            </div>
            <span className="text-[11px] font-bold text-slate-500">{labels[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Reusable Donut Legend Component ─────────────────────────────────────────
export const DonutLegend = ({
  title,
  data,
  colors,
}: {
  title: string;
  data: Record<string, number>;
  colors: Record<string, string>;
}) => {
  const total = Object.values(data).reduce((sum, value) => sum + value, 0) || 1;
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Distribution</span>
      </div>
      <div className="space-y-3">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-sm font-bold text-slate-700">
              <span className="inline-flex items-center gap-2 capitalize">
                <span className={`h-2.5 w-2.5 rounded-full ${colors[key] || 'bg-slate-400'}`} />
                {key}
              </span>
              <span>{value}</span>
            </div>
            <div className="h-2 rounded-full bg-white">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${colors[key] || 'bg-slate-400'}`}
                style={{ width: `${(value / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Modal Backdrop ──────────────────────────────────────────────────────────
export const ModalBackdrop = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    <div className="w-full max-w-lg animate-[scaleIn_0.25s_ease-out] mx-4">{children}</div>
  </div>
);
