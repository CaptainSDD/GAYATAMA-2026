import type { BusinessType, LatLng } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { CompassIcon, GaugeIcon, StoreIcon, UsersIcon } from '../../components/Icons';
import { Loading, QueryError } from '../../components/QueryState';
import { Tabs, type TabItem } from '../../components/Tabs';
import type { AnalysisResponse } from '../../lib/api-types';
import { isInIndonesia } from '../../lib/location';
import { useAnalysis, useRecommendation } from '../../lib/queries';
import { CompetitionView } from '../competition/CompetitionView';
import { RecommendView } from '../recommend/RecommendView';
import { ScorePanel } from '../score/ScorePanel';
import { SegmentsView } from '../segments/SegmentsView';

type TabKey = 'score' | 'recommend' | 'customers' | 'competitors';

// Labels name the question each tab answers. "Buka apa" read as a fragment
// rather than a heading, so it is spelled out.
const TABS: readonly TabItem<TabKey>[] = [
  { key: 'score', label: 'Skor Lokasi', icon: <GaugeIcon size={18} /> },
  { key: 'recommend', label: 'Rekomendasi', icon: <CompassIcon size={18} /> },
  { key: 'customers', label: 'Pelanggan', icon: <UsersIcon size={18} /> },
  { key: 'competitors', label: 'Kompetitor', icon: <StoreIcon size={18} /> },
];

interface LocationViewProps {
  point: LatLng;
  businessType: BusinessType;
  onBusinessTypeChange: (businessType: BusinessType) => void;
}

export function LocationView({ point, businessType, onBusinessTypeChange }: LocationViewProps) {
  const [tab, setTab] = useState<TabKey>('score');
  const inCoverage = isInIndonesia(point);
  const analysis = useAnalysis(inCoverage ? point : null, businessType);
  // Scoring all seven business types is requested only once someone opens that tab.
  const recommendation = useRecommendation(inCoverage && tab === 'recommend' ? point : null);

  if (!inCoverage) {
    return (
      <p className="notice" role="status">
        Titik ini berada di luar Indonesia. Data peta dan kategori usaha LOKABIS hanya mencakup lokasi di Indonesia.
      </p>
    );
  }

  return (
    <Tabs label="Analisis lokasi" tabs={TABS} active={tab} onChange={setTab}>
      {tab === 'recommend' ? (
        <RecommendView
          query={recommendation}
          onAnalyse={(type) => {
            onBusinessTypeChange(type);
            setTab('score');
          }}
        />
      ) : (
        <AnalysisTab tab={tab} query={analysis} point={point} />
      )}
    </Tabs>
  );
}

interface AnalysisTabProps {
  tab: Exclude<TabKey, 'recommend'>;
  query: UseQueryResult<AnalysisResponse>;
  point: LatLng;
}

function AnalysisTab({ tab, query, point }: AnalysisTabProps) {
  if (query.isPending) return <Loading message="Menganalisis lokasi ini…" />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  switch (tab) {
    case 'score':
      return <ScorePanel analysis={query.data} onRefresh={() => void query.refetch()} refreshing={query.isFetching} />;
    case 'customers':
      return <SegmentsView analysis={query.data} point={point} />;
    case 'competitors':
      return <CompetitionView analysis={query.data} />;
  }
}
