import { getAuthToken } from '../../components/main/helpers';

export const cardClass =
  'rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_22px_60px_-32px_rgba(15,23,42,0.4)]';
export const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-900 focus:bg-white';
export const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition';
export const secondaryButtonClass = `${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
export const primaryButtonClass = `${buttonClass} bg-slate-900 text-white hover:bg-slate-700`;
export const dangerButtonClass = `${buttonClass} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`;

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
