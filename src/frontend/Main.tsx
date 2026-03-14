import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  FileBarChart,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Scan,
  Settings,
  Shield,
  Sparkles,
  Type,
} from 'lucide-react';
import { downloadReport, getAuthToken } from '../components/main/helpers';
import SettingsView from '../components/main/SettingsView';
import { AnalyzeView, DashboardView, DocsView, HistoryView, ReportsView } from '../components/main/views';
import type { AnalyticsData, Log, ReportsData, ScanResult, StoredSession, ViewId } from '../components/main/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const NAV_ITEMS: Array<{ id: Exclude<ViewId, 'analyze'>; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'docs', label: 'Docs', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
];

type AnalyzeTool = 'deepfake' | 'aiText' | 'plagiarism';

const ANALYZE_TOOL_ITEMS: Array<{
  id: AnalyzeTool;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}> = [
  { id: 'deepfake', label: 'Deepfake Analyzer', icon: Scan, color: 'text-pink-300 bg-pink-500/20' },
  { id: 'aiText', label: 'A.I Text Analyzer', icon: Type, color: 'text-sky-300 bg-sky-500/20' },
  { id: 'plagiarism', label: 'Plagiarism Checker', icon: FileSearch, color: 'text-amber-300 bg-amber-500/20' },
];

const SidebarNav = ({
  currentView,
  onChangeView,
  userName,
  onLogout,
  analyzeTool,
  onSelectAnalyzeTool,
}: {
  currentView: ViewId;
  onChangeView: (view: ViewId) => void;
  userName: string;
  onLogout: () => void;
  analyzeTool: AnalyzeTool;
  onSelectAnalyzeTool: (tool: AnalyzeTool) => void;
}) => {
  const [toolsOpen, setToolsOpen] = useState(currentView === 'analyze');
  const isToolsOpen = currentView === 'analyze' || toolsOpen;

  return (
  <aside className="h-full rounded-[24px] border-r border-slate-200 bg-slate-50 p-4 md:p-5 flex flex-col">
    <div className="flex items-center gap-3 px-2 pb-5 border-b border-slate-200">
      <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
        <Shield size={20} />
      </div>
      <div>
        <p className="text-xl font-black text-slate-900 tracking-tight">FactGuard</p>
      </div>
    </div>

    <div className="space-y-2 mt-5">
      {NAV_ITEMS.map((item) => (
        <Fragment key={item.id}>
          <button
            onClick={() => onChangeView(item.id)}
            className={`w-full inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              currentView === item.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span
              className={`h-6 w-6 rounded-md flex items-center justify-center ${
                currentView === item.id
                  ? 'bg-white/15 text-white'
                  : item.id === 'dashboard'
                    ? 'bg-indigo-100 text-indigo-600'
                    : item.id === 'history'
                      ? 'bg-sky-100 text-sky-600'
                      : item.id === 'reports'
                        ? 'bg-amber-100 text-amber-600'
                        : item.id === 'docs'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-violet-100 text-violet-600'
              }`}
            >
              <item.icon size={14} />
            </span>
            {item.label}
          </button>

          {item.id === 'dashboard' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => {
                  onChangeView('analyze');
                  setToolsOpen((prev) => (currentView === 'analyze' ? !prev : true));
                }}
                className={`w-full inline-flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  currentView === 'analyze' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className={`h-6 w-6 rounded-md flex items-center justify-center ${currentView === 'analyze' ? 'bg-white/15 text-pink-200' : 'bg-pink-100 text-pink-600'}`}>
                    <Sparkles size={14} />
                  </span>
                  A.I Tools
                </span>
                {isToolsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {isToolsOpen && (
                <div className="px-2 pb-2">
                  {ANALYZE_TOOL_ITEMS.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        onSelectAnalyzeTool(tool.id);
                        onChangeView('analyze');
                      }}
                      className={`mt-1.5 w-full inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold ${
                        currentView === 'analyze' && analyzeTool === tool.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`h-5 w-5 rounded-md flex items-center justify-center ${currentView === 'analyze' && analyzeTool === tool.id ? 'bg-white/15 text-white' : tool.color}`}>
                        <tool.icon size={12} />
                      </span>
                      {tool.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Fragment>
      ))}
    </div>

    <div className="mt-auto space-y-3 pt-5">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black">
          {userName.charAt(0).toUpperCase()}
        </div>
        <p className="text-sm font-bold text-slate-700 truncate">{userName}</p>
      </div>
      <button
        onClick={onLogout}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
      >
        <LogOut size={16} />
        Logout
      </button>
    </div>
  </aside>
  );
};

const DashboardShell = ({ onLogout }: { onLogout: () => void }) => {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [reportsData, setReportsData] = useState<ReportsData | null>(null);
  const [analyzeTool, setAnalyzeTool] = useState<AnalyzeTool>('deepfake');
  const [userName, setUserName] = useState('Admin');
  const [userEmail, setUserEmail] = useState('admin@factguard.app');
  const [isMfaEnabled, setIsMfaEnabled] = useState(false);

  useEffect(() => {
    try {
      const sessionRaw = localStorage.getItem('fg_session');
      if (!sessionRaw) return;
      const session = JSON.parse(sessionRaw) as StoredSession;
      if (session.user) {
        const clean = String(session.user).split('@')[0].replace(/[._-]/g, ' ');
        setUserName(clean.charAt(0).toUpperCase() + clean.slice(1));
        setUserEmail(String(session.user));
      }
    } catch {
      // Ignore parse failures.
    }
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          onLogout();
          return;
        }
        const res = await fetch(`${API_BASE}/api/session/validate`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          onLogout();
        }
      } catch {
        onLogout();
      }
    };
    verifySession();
  }, [onLogout]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = getAuthToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/me/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.username) setUserName(String(data.username));
        if (data.email) setUserEmail(String(data.email));
        setIsMfaEnabled(Boolean(data.mfa_enabled));
      } catch {
        // Ignore settings fetch failures.
      }
    };
    fetchSettings();
  }, []);

  const fetchWorkspaceData = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const [analyticsRes, reportsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/analytics`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/daily-reports`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/audit-logs`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (analyticsRes.ok) setAnalyticsData(await analyticsRes.json());
      if (reportsRes.ok) setReportsData(await reportsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch {
      // Keep UI functional if backend is unavailable.
    }
  }, []);

  useEffect(() => {
    void fetchWorkspaceData();
    const interval = setInterval(() => {
      void fetchWorkspaceData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchWorkspaceData]);

  type PlagiarismResultCandidate = {
    foundExact?: boolean;
    foundNear?: boolean;
    matchScore?: number;
    url?: string;
  };

  type PlagiarismChunkCandidate = {
    chunkText?: string;
    results?: PlagiarismResultCandidate[];
  };

  type PlagiarismTopSource = {
    url?: string;
    strongestEvidenceScore?: number;
  };

  const handleAnalyze = async (type: 'image' | 'text' | 'plagiarism', data: string | File) => {
    setResult(null);
    setAnalyzing(true);

    try {
      const token = getAuthToken();

      const endpoint = type === 'image'
        ? `${API_BASE}/api/detect-deepfake-image`
        : type === 'plagiarism'
          ? `${API_BASE}/api/plagiarism/scan`
          : `${API_BASE}/api/detect-ai-text`;

      const body = type === 'image'
        ? (() => {
            const formData = new FormData();
            formData.append('file', data as Blob);
            return formData;
          })()
        : type === 'plagiarism'
          ? JSON.stringify({ inputText: data as string })
          : JSON.stringify({ text: data as string });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers:
          type === 'text' || type === 'plagiarism'
            ? { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
            : token
              ? { Authorization: `Bearer ${token}` }
              : undefined,
        body,
      });

      const json = await res.json();
      if (json.status === 'success' && type === 'plagiarism') {
        const topSources = Array.isArray(json.topSources) ? json.topSources.slice(0, 4) : [];
        const matchedChunks = Array.isArray(json.matchedChunks)
          ? json.matchedChunks
              .map((chunk: unknown) => {
                const typedChunk = chunk as PlagiarismChunkCandidate;
                const text = String(typedChunk.chunkText ?? '').trim();
                const results = Array.isArray(typedChunk.results) ? typedChunk.results : [];
                const best = results
                  .filter((item) => Boolean(item?.foundExact || item?.foundNear))
                  .sort((a, b) => Number(b?.matchScore ?? 0) - Number(a?.matchScore ?? 0))[0];
                if (!text || !best) return null;
                return {
                  text,
                  matchScore: Number(best?.matchScore ?? 0),
                  sourceUrl: String(best?.url ?? ''),
                };
              })
              .filter(Boolean)
          : [];

        setResult({
          id: `FG-${json.scan_id ?? Date.now()}`,
          score: typeof json.overallScore === 'number' ? json.overallScore : 0,
          type,
          artifacts: topSources.length > 0
            ? topSources.map((source: unknown) => {
                const typedSource = source as PlagiarismTopSource;
                return `${typedSource.url ?? 'Source'} (${Math.round((typedSource.strongestEvidenceScore ?? 0) * 100)}%)`;
              })
            : ['No external matches found'],
          plagiarism: {
            originalText: String(data),
            matchedChunks: matchedChunks as Array<{ text: string; matchScore: number; sourceUrl: string }>,
          },
        });
      } else if (json.status === 'success') {
        const parsed = json.result;
        setResult({
          id: `FG-${json.db_id}`,
          score: typeof parsed.confidence === 'number' ? parsed.confidence : (parsed.fake_score ?? 0),
          type,
          artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : ['No artifacts returned'],
        });
      }
      await fetchWorkspaceData();
    } catch {
      // Keep UX smooth even on network errors.
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadReport = async (type: 'synthetic' | 'authentic') => {
    const didDownload = await downloadReport(type);
    if (didDownload) {
      await fetchWorkspaceData();
    }
  };

  const pageTitle = useMemo(() => {
    if (currentView === 'analyze') {
      return analyzeTool === 'deepfake'
        ? 'Deepfake Analyzer'
        : analyzeTool === 'aiText'
          ? 'A.I Text Analyzer'
          : 'Plagiarism Checker';
    }
    const match = NAV_ITEMS.find((n) => n.id === currentView);
    return match ? match.label : 'Dashboard';
  }, [currentView, analyzeTool]);

  const handleUpdateUsername = async (username: string): Promise<{ ok: boolean; message: string }> => {
    try {
      const token = getAuthToken();
      if (!token) return { ok: false, message: 'Session expired. Please sign in again.' };
      const res = await fetch(`${API_BASE}/api/me/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: data.detail || data.message || 'Failed to update username.' };
      const nextName = String(data.username || username);
      setUserName(nextName);
      try {
        const sessionRaw = localStorage.getItem('fg_session');
        if (sessionRaw) {
          const session = JSON.parse(sessionRaw) as StoredSession;
          session.username = nextName;
          session.user = session.user || session.email;
          localStorage.setItem('fg_session', JSON.stringify(session));
        }
      } catch {
        // Ignore local storage update issues.
      }
      return { ok: true, message: 'Username updated.' };
    } catch {
      return { ok: false, message: 'Failed to update username.' };
    }
  };

  const handleToggleMfa = async (enabled: boolean): Promise<{ ok: boolean; message: string; enabled?: boolean }> => {
    try {
      const token = getAuthToken();
      if (!token) return { ok: false, message: 'Session expired. Please sign in again.' };
      const res = await fetch(`${API_BASE}/api/me/mfa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: data.detail || data.message || 'Failed to update MFA setting.' };
      const next = Boolean(data.mfa_enabled);
      setIsMfaEnabled(next);
      return { ok: true, message: next ? 'MFA enabled.' : 'MFA disabled.', enabled: next };
    } catch {
      return { ok: false, message: 'Failed to update MFA setting.' };
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string): Promise<{ ok: boolean; message: string }> => {
    try {
      const token = getAuthToken();
      if (!token) return { ok: false, message: 'Session expired. Please sign in again.' };
      const res = await fetch(`${API_BASE}/api/me/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: data.detail || data.message || 'Failed to change password.' };
      return { ok: true, message: data.message || 'Password updated successfully.' };
    } catch {
      return { ok: false, message: 'Failed to change password.' };
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900">
      <main className="w-full min-h-screen bg-white overflow-hidden">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <SidebarNav
            currentView={currentView}
            onChangeView={setCurrentView}
            userName={userName}
            onLogout={onLogout}
            analyzeTool={analyzeTool}
            onSelectAnalyzeTool={(tool) => {
              setAnalyzeTool(tool);
              setResult(null);
            }}
          />

          <section className="p-5 md:p-8">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900">{pageTitle}</h1>
                <p className="mt-1 text-sm md:text-base font-medium text-slate-500">
                  Operational workspace for analysis, audit trails, reporting, and model documentation.
                </p>
              </div>
              <div className="flex items-center gap-3 self-end md:self-start">
                <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black">
                  {userName.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {currentView === 'dashboard' && <DashboardView key="dashboard" data={analyticsData} onOpenHistory={() => setCurrentView('history')} />}
              {currentView === 'analyze' && (
                <AnalyzeView
                  key="analyze"
                  onAnalyze={handleAnalyze}
                  analyzing={analyzing}
                  result={result}
                  mode={analyzeTool === 'deepfake' ? 'image' : analyzeTool === 'aiText' ? 'text' : 'plagiarism'}
                />
              )}
              {currentView === 'history' && <HistoryView key="history" logs={logs} />}
              {currentView === 'reports' && <ReportsView key="reports" data={reportsData} onDownload={handleDownloadReport} />}
              {currentView === 'docs' && <DocsView key="docs" />}
              {currentView === 'settings' && (
                <SettingsView
                  key="settings"
                  userName={userName}
                  userEmail={userEmail}
                  isMfaEnabled={isMfaEnabled}
                  onUpdateUsername={handleUpdateUsername}
                  onToggleMfa={handleToggleMfa}
                  onChangePassword={handleChangePassword}
                />
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
};

export default DashboardShell;
