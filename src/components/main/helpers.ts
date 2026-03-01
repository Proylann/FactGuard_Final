export const getAuthToken = (): string => {
  try {
    const sessionRaw = localStorage.getItem('fg_session');
    if (!sessionRaw) return '';
    const session: any = JSON.parse(sessionRaw);
    let token: any = session?.access_token || session?.token || session?.session?.access_token || '';
    if (token && typeof token === 'object') token = token.access_token || token.token || '';
    return typeof token === 'string' ? token : '';
  } catch {
    return '';
  }
};

export const downloadReport = async (type: 'synthetic' | 'authentic') => {
  try {
    const token = getAuthToken();
    const res = await fetch(`http://127.0.0.1:8000/api/reports/download?report_type=${type}`, {
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
  } catch (err) {
    alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
  }
};
