import type { BusinessType, ComponentWeights, LatLng } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { Loading, QueryError } from '../../components/QueryState';
import { Tabs, type TabItem } from '../../components/Tabs';
import type { AnalysisResponse } from '../../lib/api-types';
import { isInSemarangCoverage } from '../../lib/location';
import { useAnalysis, useComparison, useOpportunities, useRecommendation } from '../../lib/queries';
import { ComparisonView } from '../compare/ComparisonView';
import { CompetitionView } from '../competition/CompetitionView';
import { OpportunityView } from '../opportunity/OpportunityView';
import { RecommendView } from '../recommend/RecommendView';
import { ScorePanel } from '../score/ScorePanel';
import { SegmentsView } from '../segments/SegmentsView';

type TabKey = 'score' | 'recommend' | 'customers' | 'competitors' | 'opportunity';

const TABS: readonly TabItem<TabKey>[] = [
  { key: 'score', label: 'Skor' },
  { key: 'recommend', label: 'Pilihan usaha' },
  { key: 'customers', label: 'Pelanggan' },
  { key: 'competitors', label: 'Pesaing' },
  { key: 'opportunity', label: 'Peluang' },
];

interface LocationViewProps {
  point: LatLng;
  businessType: BusinessType;
  onBusinessTypeChange: (businessType: BusinessType) => void;
  /** Moves the whole analysis to another point, keeping the chosen category. */
  onAnalysePoint: (point: LatLng) => void;
  /** Marks a point on the map while the opportunity grid points at it. */
  onHoverPoint: (point: LatLng | null) => void;
  /** null means the documented baseline; the engine is never sent anything. */
  weights: ComponentWeights | null;
  onWeightsChange: (weights: ComponentWeights | null) => void;
  /** `compare` opens on the category comparison, for visitors who have not chosen one. */
  entryMode?: 'score' | 'compare';
  /** The way out of a state the analysis cannot answer: drop the point and pick again. */
  onClearPoint: () => void;
}

export function LocationView({
  point,
  businessType,
  onBusinessTypeChange,
  onAnalysePoint,
  onHoverPoint,
  weights,
  onWeightsChange,
  entryMode = 'score',
  onClearPoint,
}: LocationViewProps) {
  const comparing = entryMode === 'compare';
  const [tab, setTab] = useState<TabKey>(comparing ? 'recommend' : 'score');
  const [compareOpen, setCompareOpen] = useState(comparing);
  const inCoverage = isInSemarangCoverage(point);
  const analysis = useAnalysis(inCoverage ? point : null, businessType, weights ?? undefined);
  // Scoring all seven business types is requested only once someone opens that tab.
  const recommendation = useRecommendation(inCoverage && tab === 'recommend' ? point : null);
  // The comparison carries more per category, so it waits until its section is opened.
  const comparison = useComparison(inCoverage && tab === 'recommend' && compareOpen ? point : null);
  // Nine analyses in one call, so this waits for its tab and is throttled hardest by the API.
  const opportunities = useOpportunities(inCoverage && tab === 'opportunity' ? point : null, businessType);

  if (!inCoverage) {
    return (
      <div className="held-back" role="status">
        <p className="held-back-title">Lokasi ini di luar cakupan</p>
        <p>
          LOKABIS baru mencakup Kota Semarang, area di dalam garis merah pada peta. Titik ini ada di luarnya, jadi
          belum bisa dinilai.
        </p>
        <button type="button" className="button-secondary" onClick={onClearPoint}>
          Pilih titik lain di peta
        </button>
      </div>
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
      ) : tab === 'opportunity' ? (
        <OpportunityView
          query={opportunities}
          // Passed straight through, not wrapped: OpportunityView clears the
          // highlight in an effect keyed on this function, so a new identity
          // every render would wipe the mark as fast as it was set.
          onHoverPoint={onHoverPoint}
          businessType={businessType}
          onAnalysePoint={(next) => {
            onAnalysePoint(next);
            setTab('score');
          }}
        />
      ) : (
        <AnalysisTab
          tab={tab}
          query={analysis}
          point={point}
          weights={weights}
          onWeightsChange={onWeightsChange}
          onClearPoint={onClearPoint}
        />
      )}
    </Tabs>
  );
}

interface AnalysisTabProps {
  tab: Exclude<TabKey, 'recommend' | 'opportunity'>;
  query: UseQueryResult<AnalysisResponse>;
  point: LatLng;
  weights: ComponentWeights | null;
  onWeightsChange: (weights: ComponentWeights | null) => void;
  onClearPoint: () => void;
}

function AnalysisTab({ tab, query, point, weights, onWeightsChange, onClearPoint }: AnalysisTabProps) {
  if (query.isPending) return <Loading message="Menganalisis lokasi ini…" />;
  if (query.isError)
    return <QueryError error={query.error} onRetry={() => void query.refetch()} onPickAnother={onClearPoint} />;

  switch (tab) {
    case 'score':
      return (
        <ScorePanel
          analysis={query.data}
          onRefresh={() => void query.refetch()}
          refreshing={query.isFetching}
          weights={weights}
          onWeightsChange={onWeightsChange}
        />
      );
    case 'customers':
      return <SegmentsView analysis={query.data} point={point} />;
    case 'competitors':
      return <CompetitionView analysis={query.data} />;
  }
}
