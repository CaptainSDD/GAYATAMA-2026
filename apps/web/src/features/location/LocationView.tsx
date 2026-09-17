import type { BusinessType, LatLng } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { Loading, QueryError } from '../../components/QueryState';
import { Tabs, type TabItem } from '../../components/Tabs';
import type { AnalysisResponse } from '../../lib/api-types';
import { isInSemarangCoverage } from '../../lib/location';
import { useAnalysis, useComparison, useRecommendation } from '../../lib/queries';
import { ComparisonView } from '../compare/ComparisonView';
import { CompetitionView } from '../competition/CompetitionView';
import { RecommendView } from '../recommend/RecommendView';
import { ScorePanel } from '../score/ScorePanel';
import { SegmentsView } from '../segments/SegmentsView';

type TabKey = 'score' | 'recommend' | 'customers' | 'competitors';

const TABS: readonly TabItem<TabKey>[] = [
  { key: 'score', label: 'Skor' },
  { key: 'recommend', label: 'Pilihan usaha' },
  { key: 'customers', label: 'Pelanggan' },
  { key: 'competitors', label: 'Pesaing' },
];

interface LocationViewProps {
  point: LatLng;
  businessType: BusinessType;
  onBusinessTypeChange: (businessType: BusinessType) => void;
  /** `compare` opens on the category comparison, for visitors who have not chosen one. */
  entryMode?: 'score' | 'compare';
}

export function LocationView({ point, businessType, onBusinessTypeChange, entryMode = 'score' }: LocationViewProps) {
  const comparing = entryMode === 'compare';
  const [tab, setTab] = useState<TabKey>(comparing ? 'recommend' : 'score');
  const [compareOpen, setCompareOpen] = useState(comparing);
  const inCoverage = isInSemarangCoverage(point);
  const analysis = useAnalysis(inCoverage ? point : null, businessType);
  // Scoring all seven business types is requested only once someone opens that tab.
  const recommendation = useRecommendation(inCoverage && tab === 'recommend' ? point : null);
  // The comparison carries more per category, so it waits until its section is opened.
  const comparison = useComparison(inCoverage && tab === 'recommend' && compareOpen ? point : null);

  if (!inCoverage) {
    return (
      <p className="notice" role="status">
        Titik ini berada di luar area cakupan Semarang. Pilih lokasi di dalam garis merah pada peta.
      </p>
    );
  }

  return (
    <Tabs label="Analisis lokasi" tabs={TABS} active={tab} onChange={setTab}>
      {tab === 'recommend' ? (
        <>
          <RecommendView
            query={recommendation}
            onAnalyse={(type) => {
              onBusinessTypeChange(type);
              setTab('score');
            }}
          />
          <ComparisonView
            query={comparison}
            open={compareOpen}
            onOpenChange={setCompareOpen}
            onAnalyse={(type) => {
              onBusinessTypeChange(type);
              setTab('score');
            }}
          />
        </>
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
