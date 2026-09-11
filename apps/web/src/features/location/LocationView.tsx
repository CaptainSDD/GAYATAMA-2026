import type { BusinessType, LatLng } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
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

const TABS: readonly TabItem<TabKey>[] = [
  { key: 'score', label: 'Score' },
  { key: 'recommend', label: 'What to open' },
  { key: 'customers', label: 'Customers' },
  { key: 'competitors', label: 'Competitors' },
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
        This point is outside Indonesia. GAYATAMA’s map data and business categories cover Indonesian locations only.
      </p>
    );
  }

  return (
    <Tabs label="Location analysis" tabs={TABS} active={tab} onChange={setTab}>
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
  if (query.isPending) return <Loading message="Analysing this location…" />;
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
