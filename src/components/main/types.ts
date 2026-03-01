export interface Log {
  time: string;
  msg: string;
  type: 'info' | 'success' | 'error';
  category?: 'analysis' | 'download' | 'auth';
}

export interface ScanResult {
  id: string;
  score: number;
  type: string;
  artifacts: string[];
  plagiarism?: {
    originalText: string;
    matchedChunks: Array<{
      text: string;
      matchScore: number;
      sourceUrl: string;
    }>;
  };
}

export interface AnalyticsData {
  total_scans: number;
  threats_detected: number;
  detection_rate: number;
  avg_confidence: number;
  quick_history: Array<{ name: string; status: string; score: string }>;
  weekly_data: number[];
  weekly_labels?: string[];
  weekly_plagiarism_data?: number[];
  weekly_text_data?: number[];
  weekly_ai_data?: number[];
  monthly_data?: number[];
  monthly_labels?: string[];
  monthly_plagiarism_data?: number[];
  monthly_text_data?: number[];
  monthly_ai_data?: number[];
}

export interface ReportsData {
  synthetic_count: number;
  authentic_count: number;
  total_scans: number;
  synthetic_avg_confidence: number;
  report_date: string;
}

export type ViewId = 'dashboard' | 'analyze' | 'history' | 'reports' | 'docs' | 'settings';
