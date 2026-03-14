import type { StoredSession } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const getStoredSession = (): StoredSession | null => {
  try {
    const sessionRaw = localStorage.getItem('fg_session');
    return sessionRaw ? (JSON.parse(sessionRaw) as StoredSession) : null;
  } catch {
    return null;
  }
};

export const getAuthToken = (): string => {
  try {
    const session = getStoredSession();
    if (!session) return '';
    const token = session.access_token || session.token || '';
    return typeof token === 'string' ? token : '';
  } catch {
    return '';
  }
};

export const downloadReport = async (type: 'synthetic' | 'authentic'): Promise<boolean> => {
  try {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/api/reports/download?report_type=${type}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) throw new Error('Failed to download report');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factguard_${type}_report.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
};
