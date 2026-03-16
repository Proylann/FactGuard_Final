import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  FileBarChart,
  FileText,
  Scan,
  Shield,
  Upload,
  Video,
} from 'lucide-react';
import { DashboardKpiCard, MetricTile } from './cards';
import { fadeIn } from './animations';
import type { AnalyticsData, Log, ReportsData, ScanResult } from './types';

type TrendView = 'weekly' | 'monthly';

const EMPTY_ANALYTICS_DATA: AnalyticsData = {
  total_scans: 0,
  threats_detected: 0,
  detection_rate: 0,
  avg_confidence: 0,
  quick_history: [],
  weekly_data: [0, 0, 0, 0, 0, 0, 0],
  weekly_labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  weekly_plagiarism_data: [0, 0, 0, 0, 0, 0, 0],
  weekly_text_data: [0, 0, 0, 0, 0, 0, 0],
  weekly_ai_data: [0, 0, 0, 0, 0, 0, 0],
  monthly_data: Array.from({ length: 12 }, () => 0),
  monthly_labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
  monthly_plagiarism_data: Array.from({ length: 12 }, () => 0),
  monthly_text_data: Array.from({ length: 12 }, () => 0),
  monthly_ai_data: Array.from({ length: 12 }, () => 0),
};

export const DashboardView = ({
  data,
  onOpenHistory,
}: {
  data: AnalyticsData | null;
  onOpenHistory: () => void;
}) => {
  const [trendView, setTrendView] = useState<TrendView>('weekly');

  const displayData = data || EMPTY_ANALYTICS_DATA;

  const trendData = useMemo(() => {
    if (trendView === 'monthly') {
      return {
        series: displayData.monthly_data || [],
        labels: displayData.monthly_labels || [],
        plagiarism: displayData.monthly_plagiarism_data || [],
        text: displayData.monthly_text_data || [],
        ai: displayData.monthly_ai_data || [],
        subtitle: 'Last 12 months',
      };
    }
    return {
      series: displayData.weekly_data || [],
      labels: displayData.weekly_labels || [],
      plagiarism: displayData.weekly_plagiarism_data || [],
      text: displayData.weekly_text_data || [],
      ai: displayData.weekly_ai_data || [],
      subtitle: 'Last 7 days',
    };
  }, [displayData, trendView]);

  const maxVal = Math.max(...trendData.series, 1);

  return (
    <motion.section variants={fadeIn} initial="initial" animate="animate" exit="exit" className="space-y-8">
      <div className="rounded-2xl border border-slate-900/60 bg-gradient-to-r from-black via-slate-900 to-black p-5 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <DashboardKpiCard
            label="Total Scans"
            value={displayData.total_scans.toString()}
            delta="+28%"
            barWidth={100}
            icon={Scan}
            tone="pink"
          />
          <DashboardKpiCard
            label="Threats Found"
            value={displayData.threats_detected.toString()}
            delta="+14%"
            barWidth={(displayData.threats_detected / Math.max(displayData.total_scans, 1)) * 100}
            icon={Shield}
            tone="orange"
          />
          <DashboardKpiCard
            label="Detection Rate"
            value={`${displayData.detection_rate.toFixed(1)}%`}
            delta="+5.7%"
            barWidth={displayData.detection_rate}
            icon={FileBarChart}
            tone="teal"
          />
          <DashboardKpiCard
            label="Avg Accuracy Rate"
            value={`${displayData.avg_confidence.toFixed(1)}%`}
            delta="+9.1%"
            barWidth={displayData.avg_confidence}
            icon={FileText}
            tone="purple"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-2xl font-black text-slate-900">Threat Detection Overview</h3>
              <p className="text-sm font-semibold text-slate-500 mt-1">{trendData.subtitle} activity and trend movement</p>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setTrendView('weekly')}
                className={`rounded-lg px-3 py-1.5 text-xs font-black ${trendView === 'weekly' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
              >
                Weekly
              </button>
              <button
                onClick={() => setTrendView('monthly')}
                className={`rounded-lg px-3 py-1.5 text-xs font-black ${trendView === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 h-[290px]">
            <div className="grid h-full items-end gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(trendData.series.length, 1)}, minmax(0, 1fr))` }}>
              {trendData.series.map((value, idx) => (
                <div key={idx} className="relative h-full flex items-end group">
                  <div className="pointer-events-none absolute -top-24 left-1/2 z-20 w-32 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-2 text-[10px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-75 group-hover:opacity-100">
                    <p>Total scans {value}</p>
                    <p>{trendData.plagiarism[idx] ?? 0} plagia</p>
                    <p>{trendData.text[idx] ?? 0} text</p>
                    <p>{trendData.ai[idx] ?? 0} A.I</p>
                  </div>
                  <div className="h-full w-full rounded-xl bg-slate-200 p-1 flex items-end">
                    <div
                      className="w-full rounded-lg bg-slate-900"
                      style={{ height: `${Math.max(8, (value / maxVal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="mt-4 grid text-center text-[10px] font-black tracking-wider text-slate-400 uppercase"
            style={{ gridTemplateColumns: `repeat(${Math.max(trendData.labels.length, 1)}, minmax(0, 1fr))` }}
          >
            {trendData.labels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
        </div>

        <div className="xl:col-span-4 rounded-3xl border border-slate-200 bg-white p-6 md:p-7 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-2xl font-black text-slate-900">Recent Scans</h3>
            <button
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100"
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {displayData.quick_history.length === 0 ? (
              <p className="text-sm italic text-slate-400">No scans yet</p>
            ) : (
              displayData.quick_history.map((item, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Scanned item</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-md ${item.status === 'Synthetic' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {item.status}
                    </span>
                    <p className="text-xs font-bold text-slate-500 mt-2">{item.score}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
};

type AnalyzeMode = 'image' | 'text' | 'plagiarism';

type AnalyzeViewProps = {
  onAnalyze: (type: 'image' | 'text' | 'plagiarism', data: string | File) => void;
  analyzing: boolean;
  result: ScanResult | null;
  mode: AnalyzeMode;
};

type PlagiarismHighlightRange = {
  start: number;
  end: number;
  matchScore: number;
  sourceUrl: string;
};

const buildPlagiarismRanges = (
  originalText: string,
  matchedChunks: Array<{ text: string; matchScore: number; sourceUrl: string }>,
): PlagiarismHighlightRange[] => {
  const sourceText = originalText || '';
  if (!sourceText.trim()) return [];

  const lower = sourceText.toLowerCase();
  const ranges: PlagiarismHighlightRange[] = [];

  matchedChunks.forEach((chunk) => {
    const needle = String(chunk.text || '').trim();
    if (!needle || needle.length < 8) return;

    const needleLower = needle.toLowerCase();
    let fromIndex = 0;
    while (fromIndex < lower.length) {
      const idx = lower.indexOf(needleLower, fromIndex);
      if (idx === -1) break;
      ranges.push({
        start: idx,
        end: idx + needle.length,
        matchScore: Math.max(0, Math.min(1, Number(chunk.matchScore || 0))),
        sourceUrl: String(chunk.sourceUrl || ''),
      });
      fromIndex = idx + Math.max(1, Math.floor(needle.length / 3));
    }
  });

  if (ranges.length === 0) return [];

  ranges.sort((a, b) => (a.start - b.start) || (b.end - a.end));
  const merged: PlagiarismHighlightRange[] = [];
  for (const current of ranges) {
    const last = merged[merged.length - 1];
    if (!last || current.start > last.end) {
      merged.push({ ...current });
      continue;
    }
    last.end = Math.max(last.end, current.end);
    if (current.matchScore > last.matchScore) {
      last.matchScore = current.matchScore;
      last.sourceUrl = current.sourceUrl;
    }
  }
  return merged;
};

export const AnalyzeView = ({ onAnalyze, analyzing, result, mode }: AnalyzeViewProps) => {
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedTextName, setUploadedTextName] = useState('');
  const [textEntryMode, setTextEntryMode] = useState<'typed' | 'file'>('typed');

  const handleTextFile = async (file: File) => {
    const content = await file.text();
    setTextInput(content);
    setUploadedTextName(file.name);
  };

  const wordCount = textInput.trim() ? textInput.trim().split(/\s+/).length : 0;
  const wordLimit = mode === 'plagiarism' ? 2500 : 1000;
  const isOverWordLimit = mode !== 'image' && wordCount > wordLimit;
  const plagiarismRanges = useMemo(
    () => (result?.plagiarism ? buildPlagiarismRanges(result.plagiarism.originalText, result.plagiarism.matchedChunks) : []),
    [result],
  );
  const isSyntheticResult = mode === 'plagiarism'
    ? (result?.isSynthetic ?? ((result?.score ?? 0) >= 40))
    : (result?.isSynthetic ?? ((result?.score ?? 0) > 50));

  const handleSubmit = () => {
    if (mode === 'image' && selectedFile) onAnalyze('image', selectedFile);
    if (mode === 'text' && textInput.trim() && !isOverWordLimit) onAnalyze('text', textInput);
    if (mode === 'plagiarism' && textInput.trim() && !isOverWordLimit) onAnalyze('plagiarism', textInput);
  };

  return (
    <motion.section variants={fadeIn} initial="initial" animate="animate" exit="exit" className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.45)]">
          {mode === 'image' && (
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
              <Video size={16} />
              Visual Media
            </div>
          )}

          <div className="mt-6">
            {mode === 'image' ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center min-h-[360px] flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-2xl bg-white text-slate-700 border border-slate-200 flex items-center justify-center">
                  <Upload size={28} />
                </div>
                <h3 className="mt-4 text-2xl font-black text-slate-900">Upload Image or Video</h3>
                <p className="mt-2 text-sm font-semibold text-slate-500">Supported: MP4, AVI, JPG, PNG (Max 100MB)</p>

                <label className="mt-6 rounded-xl bg-slate-900 text-white px-6 py-3 text-sm font-bold cursor-pointer hover:bg-slate-700">
                  Select File
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                    }}
                  />
                </label>

                {selectedFile && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                    {selectedFile.name}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setTextEntryMode('typed')}
                    className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold ${
                      textEntryMode === 'typed'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <FileText size={16} /> Text Content
                  </button>
                  <button
                    onClick={() => setTextEntryMode('file')}
                    className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold ${
                      textEntryMode === 'file'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <Upload size={16} /> Upload File
                  </button>
                </div>
                {textEntryMode === 'file' ? (
                  <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center min-h-[250px] flex flex-col items-center justify-center">
                    <div className="h-14 w-14 rounded-2xl bg-white text-slate-700 border border-slate-200 flex items-center justify-center">
                      <Upload size={24} />
                    </div>
                    <h3 className="mt-4 text-xl font-black text-slate-900">Upload Text File</h3>
                    <p className="mt-2 text-sm font-semibold text-slate-500">Supported: TXT, MD, CSV, JSON (Text Files Only)</p>

                    <label className="mt-6 rounded-xl bg-slate-900 text-white px-6 py-3 text-sm font-bold cursor-pointer hover:bg-slate-700">
                      Select File
                      <input
                        type="file"
                        className="hidden"
                        accept=".txt,.md,.csv,.json"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) await handleTextFile(file);
                        }}
                      />
                    </label>

                    {uploadedTextName && (
                      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                        {uploadedTextName}
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={
                      mode === 'plagiarism'
                        ? 'Paste text for plagiarism checking...'
                        : 'Paste article text, transcript, or social media content here...'
                    }
                    className="min-h-[240px] w-full rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-800 placeholder:text-slate-400 outline-none resize-none"
                  />
                )}
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={isOverWordLimit ? 'text-rose-600' : 'text-slate-500'}>
                    {wordCount}/{wordLimit} words
                  </span>
                  {isOverWordLimit && <span className="text-rose-600">Reduce text to continue.</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.45)]">
          <h3 className="text-lg font-black text-slate-900">Detection Criteria</h3>
          <div className="mt-5 space-y-3">
            {(mode === 'image'
              ? ['Facial blending analysis', 'Lighting inconsistencies', 'Compression artifacts', 'Audio-visual sync']
              : mode === 'text'
                ? ['Sentiment patterns', 'Stylometric analysis', 'Source verification', 'Logic consistency']
                : ['Source overlap search', 'Near-match checking', 'Similarity scoring', 'Cross-site evidence']
            ).map((item, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={analyzing || (mode === 'image' ? !selectedFile : !textInput.trim() || isOverWordLimit)}
            className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-white font-black hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {analyzing ? 'Analyzing...' : mode === 'plagiarism' ? 'Run Plagiarism Scan' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-8 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.45)]"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-slate-900">
                {mode === 'plagiarism' ? 'Plagiarism Scan Result' : isSyntheticResult ? 'Synthetic Content Detected' : 'Likely Authentic'}
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">Scan ID: {result.id}</p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-5 py-4 text-center text-white">
              <p className="text-xs uppercase tracking-wider text-slate-300 font-black">{mode === 'plagiarism' ? 'Similarity' : 'Accuracy Rate'}</p>
              <p className="text-3xl font-black mt-1">{result.score.toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-5 rounded-full bg-slate-200 h-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${isSyntheticResult ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.max(5, Math.min(result.score, 100))}%` }}
            />
          </div>
          <div className="mt-5 space-y-2">
            {result.artifacts.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 font-medium">
                {item}
              </div>
            ))}
          </div>
          {mode === 'plagiarism' && result.plagiarism && (
            <div className="mt-6 space-y-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-600">Highlighted Suspicious Text</h4>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Marked segments are likely copied or near-copied content.
                </p>
              </div>

              <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-amber-200 bg-amber-50/40 p-4 text-sm leading-7 text-slate-800">
                {plagiarismRanges.length === 0 && result.plagiarism.originalText}
                {plagiarismRanges.length > 0 && (() => {
                  const pieces = [];
                  let cursor = 0;
                  plagiarismRanges.forEach((range, index) => {
                    if (range.start > cursor) {
                      pieces.push(
                        <span key={`plain-${index}-${cursor}`}>
                          {result.plagiarism?.originalText.slice(cursor, range.start)}
                        </span>,
                      );
                    }
                    pieces.push(
                      <mark
                        key={`hit-${index}-${range.start}`}
                        className="rounded bg-amber-300/70 px-0.5 text-slate-900"
                        title={`${Math.round(range.matchScore * 100)}% match${range.sourceUrl ? ` - ${range.sourceUrl}` : ''}`}
                      >
                        {result.plagiarism?.originalText.slice(range.start, range.end)}
                      </mark>,
                    );
                    cursor = range.end;
                  });
                  if (cursor < result.plagiarism.originalText.length) {
                    pieces.push(<span key="plain-tail">{result.plagiarism.originalText.slice(cursor)}</span>);
                  }
                  return pieces;
                })()}
              </div>

              {result.plagiarism.matchedChunks.length > 0 && (
                <div className="space-y-2">
                  {result.plagiarism.matchedChunks.slice(0, 6).map((chunk, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                        Match {idx + 1}: {Math.round(chunk.matchScore * 100)}%
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{chunk.text}</p>
                      {chunk.sourceUrl && (
                        <a
                          href={chunk.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-sky-700 underline"
                        >
                          {chunk.sourceUrl}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.section>
  );
};

export const HistoryView = ({ logs }: { logs: Log[] }) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'analysis' | 'download' | 'auth'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const displayLogs = logs.length > 0
    ? logs
    : [
        { time: '10:45:12', msg: 'Video analysis completed', type: 'success' as const, category: 'analysis' as const },
        { time: '10:42:35', msg: 'User authentication successful', type: 'info' as const, category: 'auth' as const },
        { time: '09:12:08', msg: 'PDF report generated', type: 'info' as const, category: 'download' as const },
        { time: '08:16:49', msg: 'A.I text analysis completed', type: 'success' as const, category: 'analysis' as const },
      ];

  const normalizedLogs = displayLogs.map((log) => ({
    ...log,
    category:
      log.category ||
      (log.msg.toLowerCase().includes('analysis')
        ? 'analysis'
        : log.msg.toLowerCase().includes('report')
          ? 'download'
          : 'auth'),
  }));

  const filteredLogs = normalizedLogs
    .filter((log) => (categoryFilter === 'all' ? true : log.category === categoryFilter))
    .filter((log) => log.msg.toLowerCase().includes(query.toLowerCase()) || log.time.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const valueA = a.timestamp ? new Date(a.timestamp).getTime() : new Date(`1970-01-01T${a.time}`).getTime();
      const valueB = b.timestamp ? new Date(b.timestamp).getTime() : new Date(`1970-01-01T${b.time}`).getTime();
      return sortOrder === 'newest' ? valueB - valueA : valueA - valueB;
    });

  return (
    <motion.section variants={fadeIn} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h3 className="text-2xl font-black text-slate-900">Audit Log Stream</h3>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter logs..."
              className="w-full md:w-72 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm placeholder:text-slate-400 outline-none"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | 'analysis' | 'download' | 'auth')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none"
            >
              <option value="all">All Events</option>
              <option value="analysis">Analysis Only</option>
              <option value="download">Download Only</option>
              <option value="auth">Authentication</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-3 pr-4 font-black">Timestamp</th>
                <th className="py-3 pr-4 font-black">Event</th>
                <th className="py-3 pr-4 font-black">Type</th>
                <th className="py-3 font-black">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-4 pr-4 text-xs font-mono text-slate-500">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : log.time}
                  </td>
                  <td className="py-4 pr-4 text-sm font-bold text-slate-800">{log.msg}</td>
                  <td className="py-4 pr-4">
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{log.category}</span>
                  </td>
                  <td className="py-4">
                    <span className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${log.type === 'error' ? 'bg-red-100 text-red-600' : log.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                      {log.type === 'error' ? 'Warning' : log.type === 'success' ? 'Completed' : 'Info'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm font-semibold text-slate-400">
                    No audit logs match your current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
};

export const ReportsView = ({
  data,
  onDownload,
}: {
  data: ReportsData | null;
  onDownload?: (type: 'synthetic' | 'authentic') => Promise<void> | void;
}) => {
  const displayData = data || {
    synthetic_count: 0,
    authentic_count: 0,
    total_scans: 0,
    synthetic_avg_confidence: 0,
    report_date: new Date().toISOString().split('T')[0],
  };

  return (
    <motion.section variants={fadeIn} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">Daily Summary</p>
        <h3 className="mt-2 text-2xl font-black text-slate-900">Report Date: {displayData.report_date}</h3>
        <div className="mt-5 grid sm:grid-cols-3 gap-4">
          <MetricTile label="Total Scans" value={displayData.total_scans.toString()} hint="Combined verified and flagged" variant="primary" />
          <MetricTile label="Synthetic" value={displayData.synthetic_count.toString()} hint="Potentially manipulated" />
          <MetricTile label="Authentic" value={displayData.authentic_count.toString()} hint="Verified genuine" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-rose-200 bg-white p-8">
          <h4 className="text-xl font-black text-slate-900">Synthetic Media</h4>
          <p className="mt-2 text-sm font-semibold text-slate-500">Flagged content analysis</p>
          <div className="mt-6 space-y-3">
            <div className="flex justify-between rounded-xl bg-rose-50 border border-rose-100 p-4">
              <span className="text-sm font-bold text-slate-600">Total Flagged</span>
              <span className="text-lg font-black text-rose-600">{displayData.synthetic_count}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-slate-50 border border-slate-200 p-4">
              <span className="text-sm font-bold text-slate-600">Avg Confidence</span>
              <span className="text-lg font-black text-slate-800">{displayData.synthetic_avg_confidence.toFixed(1)}%</span>
            </div>
          </div>
          <button onClick={() => void onDownload?.('synthetic')} className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-black text-white hover:bg-rose-600">
            Download PDF Report
          </button>
        </div>

        <div className="rounded-3xl border border-emerald-200 bg-white p-8">
          <h4 className="text-xl font-black text-slate-900">Authentic Media</h4>
          <p className="mt-2 text-sm font-semibold text-slate-500">Verified content summary</p>
          <div className="mt-6 space-y-3">
            <div className="flex justify-between rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <span className="text-sm font-bold text-slate-600">Total Verified</span>
              <span className="text-lg font-black text-emerald-600">{displayData.authentic_count}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-slate-50 border border-slate-200 p-4">
              <span className="text-sm font-bold text-slate-600">Total Scans</span>
              <span className="text-lg font-black text-slate-800">{displayData.total_scans}</span>
            </div>
          </div>
          <button onClick={() => void onDownload?.('authentic')} className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-black text-white hover:bg-emerald-600">
            Download PDF Report
          </button>
        </div>
      </div>
    </motion.section>
  );
};

export const DocsView = () => (
  <motion.section variants={fadeIn} initial="initial" animate="animate" exit="exit" className="space-y-6 max-w-5xl">
    <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10">
      <h3 className="text-3xl font-black text-slate-900">AI Model Documentation</h3>
      <p className="mt-3 text-slate-600 font-medium leading-relaxed">
        FactGuard uses three dedicated model pipelines for media authenticity analysis, AI text detection, and web-scale plagiarism checks.
      </p>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h4 className="text-xl font-black text-slate-900">Model Specifications</h4>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-200 pb-3"><span className="font-bold text-slate-600">Vision Model</span><span className="font-black text-slate-900">ViT-Deepfake-Detector-v1</span></div>
          <div className="flex justify-between border-b border-slate-200 pb-3"><span className="font-bold text-slate-600">Text Classifier</span><span className="font-black text-slate-900">RoBERTa Sequence Classifier</span></div>
          <div className="flex justify-between"><span className="font-bold text-slate-600">Plagiarism Engine</span><span className="font-black text-slate-900">Web Similarity + Near-Match Scorer</span></div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h5 className="text-sm font-black uppercase tracking-wider text-slate-500">Deepfake Analyzer</h5>
          <p className="mt-2 text-sm font-semibold text-slate-700">Uses a Vision Transformer for image classification and artifact extraction.</p>
          <p className="mt-2 text-xs text-slate-500">Outputs: accuracy rate, synthetic/authentic status, and artifacts like blending boundaries or lighting anomalies.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h5 className="text-sm font-black uppercase tracking-wider text-slate-500">A.I Text Analyzer</h5>
          <p className="mt-2 text-sm font-semibold text-slate-700">Runs a fine-tuned transformer classifier against linguistic structure and generation patterns.</p>
          <p className="mt-2 text-xs text-slate-500">Outputs: accuracy rate, synthetic/human status, and top stylistic indicators.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h5 className="text-sm font-black uppercase tracking-wider text-slate-500">Plagiarism Checker</h5>
          <p className="mt-2 text-sm font-semibold text-slate-700">Chunk-based web retrieval plus near-match evidence scoring across indexed sources.</p>
          <p className="mt-2 text-xs text-slate-500">Outputs: overall similarity score, top matching sources, and chunk-level evidence.</p>
        </div>
      </div>
    </div>
  </motion.section>
);
