// Reusable admin-only components.
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
    <div className="mx-4 w-full max-w-lg animate-[scaleIn_0.25s_ease-out]">{children}</div>
  </div>
);
