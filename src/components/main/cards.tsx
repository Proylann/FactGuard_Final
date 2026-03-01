import type { FC } from 'react';

export const DashboardKpiCard = ({
  label,
  value,
  delta,
  barWidth,
  icon: Icon,
  tone = 'pink',
}: {
  label: string;
  value: string;
  delta: string;
  barWidth: number;
  icon: FC<{ size?: number; className?: string }>;
  tone?: 'pink' | 'orange' | 'teal' | 'purple';
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div
        className={`h-7 w-7 rounded-md flex items-center justify-center text-white ${
          tone === 'orange'
            ? 'bg-orange-400'
            : tone === 'teal'
              ? 'bg-teal-500'
              : tone === 'purple'
                ? 'bg-violet-500'
                : 'bg-pink-500'
        }`}
      >
        <Icon size={14} />
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
          tone === 'orange'
            ? 'bg-orange-100 text-orange-600'
            : tone === 'teal'
              ? 'bg-teal-100 text-teal-600'
              : tone === 'purple'
                ? 'bg-violet-100 text-violet-600'
                : 'bg-pink-100 text-pink-600'
        }`}
      >
        {delta}
      </span>
    </div>
    <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-slate-600">{label}</p>
    <p className="mt-1 text-[36px] font-black leading-none text-slate-900">{value}</p>
    <div className="mt-2.5 h-1 rounded-full bg-slate-200/80">
      <div
        className={`h-full rounded-full ${
          tone === 'orange'
            ? 'bg-orange-400'
            : tone === 'teal'
              ? 'bg-teal-500'
              : tone === 'purple'
                ? 'bg-violet-500'
                : 'bg-pink-500'
        }`}
        style={{ width: `${Math.max(6, Math.min(barWidth, 100))}%` }}
      />
    </div>
  </div>
);

export const MetricTile = ({
  label,
  value,
  hint,
  variant = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  variant?: 'default' | 'primary';
}) => (
  <div className={`rounded-2xl p-5 ${variant === 'primary' ? 'border border-slate-900 bg-slate-900 text-white' : 'border border-slate-200 bg-white'}`}>
    <p className={`text-xs font-black uppercase tracking-wider ${variant === 'primary' ? 'text-slate-300' : 'text-slate-500'}`}>{label}</p>
    <p className={`mt-2 text-3xl font-black ${variant === 'primary' ? 'text-white' : 'text-slate-900'}`}>{value}</p>
    <p className={`mt-2 text-sm font-semibold ${variant === 'primary' ? 'text-slate-300' : 'text-slate-500'}`}>{hint}</p>
  </div>
);
