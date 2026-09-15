import type { Facility } from '@gayatama/scoring';
import { accessContext, withMappedSeverance } from '../src/overpass/severance';
import { ORIGIN, line, node, offset } from './fixtures';

function facility(north: number, east: number): Facility {
  const point = offset(ORIGIN, north, east);
  return { id: 'target', kind: 'school', lat: point.lat, lng: point.lon };
}

const STRONG_BARRIERS: readonly { tags: Record<string, string>; label: string }[] = [
  { tags: { railway: 'rail' }, label: 'rail' },
  { tags: { waterway: 'river' }, label: 'river' },
  { tags: { highway: 'motorway' }, label: 'motorway' },
];

describe('mapped access severance', () => {
  it('penalises a major road crossing and leaves facilities on the same side alone', () => {
    const context = accessContext([line({ highway: 'primary' }, [[-200, 100], [200, 100]])]);

    expect(withMappedSeverance([facility(0, 300)], ORIGIN, context)[0]?.severance).toBe('major_road');
    expect(withMappedSeverance([facility(0, -300)], ORIGIN, context)[0]?.severance).toBeUndefined();
  });

  it.each(STRONG_BARRIERS)('uses the stronger factor for a mapped $label barrier', ({ tags }) => {
    const context = accessContext([line(tags, [[-200, 100], [200, 100]])]);
    expect(withMappedSeverance([facility(0, 300)], ORIGIN, context)[0]?.severance).toBe('rail_river_toll');
  });

  it('does not penalise a major road when a crossing is mapped near the intersection', () => {
    const context = accessContext([
      line({ highway: 'primary' }, [[-200, 100], [200, 100]]),
      node({ highway: 'crossing' }, 0, 100),
    ]);
    expect(withMappedSeverance([facility(0, 300)], ORIGIN, context)[0]?.severance).toBeUndefined();
  });

  it('does not let the wrong kind of passage cancel a barrier', () => {
    const context = accessContext([
      line({ railway: 'rail' }, [[-200, 100], [200, 100]]),
      node({ highway: 'crossing' }, 0, 100),
    ]);
    expect(withMappedSeverance([facility(0, 300)], ORIGIN, context)[0]?.severance).toBe('rail_river_toll');
  });

  it('treats mapped bridge or tunnel geometry as a passage for any barrier', () => {
    const context = accessContext([
      line({ waterway: 'river' }, [[-200, 100], [200, 100]]),
      line({ highway: 'residential', bridge: 'yes' }, [[0, 80], [0, 120]]),
    ]);
    expect(withMappedSeverance([facility(0, 300)], ORIGIN, context)[0]?.severance).toBeUndefined();
  });

  it('prefers the stronger barrier when a route crosses more than one kind', () => {
    const context = accessContext([
      line({ highway: 'primary' }, [[-200, 80], [200, 80]]),
      line({ waterway: 'canal' }, [[-200, 160], [200, 160]]),
    ]);
    expect(withMappedSeverance([facility(0, 300)], ORIGIN, context)[0]?.severance).toBe('rail_river_toll');
  });

  it('does not mutate a cached facility object', () => {
    const original = facility(0, 300);
    const context = accessContext([line({ highway: 'primary' }, [[-200, 100], [200, 100]])]);
    const [annotated] = withMappedSeverance([original], ORIGIN, context);
    expect(annotated).not.toBe(original);
    expect(original.severance).toBeUndefined();
  });

  it('preserves a stronger severance supplied by another trusted source', () => {
    const original = { ...facility(0, 300), severance: 'rail_river_toll' as const };
    const context = accessContext([line({ highway: 'primary' }, [[-200, 100], [200, 100]])]);
    expect(withMappedSeverance([original], ORIGIN, context)[0]?.severance).toBe('rail_river_toll');
  });
});
