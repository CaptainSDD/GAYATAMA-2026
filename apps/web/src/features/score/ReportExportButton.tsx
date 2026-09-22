import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DownloadIcon } from '../../components/Icons';
import type { AnalysisResponse } from '../../lib/api-types';
import { PREPARING_HTML, writeReport } from '../../lib/report-export';
import { gatherReportData } from '../../lib/report-data';
import { useIdToken } from '../auth/useIdToken';

/**
 * Opens a print-ready report; the browser's Save as PDF option writes the file.
 *
 * The report covers all five chapters, and three of them live behind endpoints
 * the interface only calls when their tab is opened, so pressing this may have to
 * fetch. The window is opened *before* any awaiting: a `window.open` that happens
 * after an await has lost the user gesture that permits it, and pop-up blockers
 * refuse it. So the tab is claimed immediately, given a holding page, and
 * rewritten once the data arrives.
 */
export function ReportExportButton({ analysis }: { analysis: AnalysisResponse }) {
  const client = useQueryClient();
  const idToken = useIdToken();
  const [state, setState] = useState<'idle' | 'preparing' | 'failed'>('idle');

  const open = () => {
    if (idToken === null) return;
    const target = window.open('', '_blank');
    if (target === null) {
      window.alert('Browser memblokir jendela laporan. Izinkan pop-up untuk situs ini lalu coba lagi.');
      return;
    }
    target.opener = null;
    target.document.write(PREPARING_HTML);
    setState('preparing');

    void gatherReportData(client, analysis, idToken).then(
      (data) => {
        writeReport(target, data);
        setState('idle');
      },
      () => {
        // Only reached if gathering itself throws; each chapter already absorbs
        // its own failure and is reported as missing inside the document.
        target.close();
        setState('failed');
      },
    );
  };

  return (
    <div className="report-export-block">
      <button
        type="button"
        className="button-secondary report-export"
        onClick={open}
        disabled={state === 'preparing' || idToken === null}
        aria-busy={state === 'preparing'}
      >
        <DownloadIcon size={18} /> {state === 'preparing' ? 'Menyiapkan laporan…' : 'Export laporan PDF'}
      </button>
      {state === 'failed' && (
        <p className="notice" role="alert">
          Laporan gagal disiapkan. Coba lagi sebentar lagi.
        </p>
      )}
    </div>
  );
}
