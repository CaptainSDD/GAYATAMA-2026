import type { SaturationReading } from '@gayatama/scoring';
import { SATURATION_LABELS } from '../../lib/copy';

interface SaturationMeterProps {
  reading: SaturationReading;
  businessLabel: string;
}

export function SaturationMeter({ reading, businessLabel }: SaturationMeterProps) {
  return (
    <div className="competition-verdict">
      <span className="eyebrow">Kondisi persaingan</span>
      <p className="competition-state">{SATURATION_LABELS[reading]}</p>
      <p>{saturationExplanation(reading, businessLabel)}</p>
    </div>
  );
}

function saturationExplanation(reading: SaturationReading, businessLabel: string): string {
  switch (reading) {
    case 'not_saturated':
      return `Sedikit ${businessLabel.toLowerCase()} ditemukan, tetapi permintaannya juga belum cukup terbukti.`;
    case 'healthy':
      return `Jumlah ${businessLabel.toLowerCase()} masih seimbang dengan potensi pelanggan di sekitar.`;
    case 'becoming_saturated':
      return `Jumlah ${businessLabel.toLowerCase()} mulai padat. Usaha baru perlu pembeda yang jelas.`;
    case 'saturated':
      return `Banyak ${businessLabel.toLowerCase()} sudah melayani area ini sehingga ruang untuk usaha baru menyempit.`;
    case 'heavily_saturated':
      return `Persaingan ${businessLabel.toLowerCase()} sangat padat dibanding potensi pelanggan yang terdeteksi.`;
  }
}
