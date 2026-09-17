import { DownloadIcon } from '../../components/Icons';
import type { AnalysisResponse } from '../../lib/api-types';
import { exportReport } from '../../lib/report-export';

/** Opens a print-ready report; the browser's Save as PDF option writes the file. */
export function ReportExportButton({ analysis }: { analysis: AnalysisResponse }) {
  return (
    <button type="button" className="button-secondary report-export" onClick={() => exportReport(analysis)}>
      <DownloadIcon size={18} /> Export laporan PDF
    </button>
  );
}
