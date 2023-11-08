import { GenMapping, addSegment, setSourceContent } from '@jridgewell/gen-mapping';
import { traceSegment, decodedMappings } from '@jridgewell/trace-mapping';

import type { TraceMap } from '@jridgewell/trace-mapping';

export type SourceMapSegmentObject =
  | {
      column: number;
      line: number;
      name: string;
      source: string;
      content: string | null;
    }
  | {
      column: null;
      line: null;
      name: null;
      source: null;
      content: null;
    };

const SOURCELESS_MAPPING = {
  source: null,
  column: null,
  line: null,
  name: null,
  content: null,
};
const EMPTY_SOURCES: Sources[] = [];

export type OriginalSource = {
  map: TraceMap;
  sources: Sources[];
  source: string;
  content: string | null;
};

export type MapSource = {
  map: TraceMap;
  sources: Sources[];
  source: string;
  content: string | null;
};

export type Sources = OriginalSource | MapSource;

function Source<M extends TraceMap | null>(
  map: TraceMap | null,
  sources: Sources[],
  source: string,
  content: string | null
): M extends null ? OriginalSource : MapSource {
  return {
    map,
    sources,
    source,
    content,
  } as any;
}

/**
 * MapSource represents a single sourcemap, with the ability to trace mappings into its child nodes
 * (which may themselves be SourceMapTrees).
 */
export function MapSource(map: TraceMap, sources: Sources[]): MapSource {
  return Source(map, sources, '', null);
}

/**
 * A "leaf" node in the sourcemap tree, representing an original, unmodified source file. Recursive
 * segment tracing ends at the `OriginalSource`.
 */
export function OriginalSource(source: string, content: string | null): OriginalSource {
  return Source(null, EMPTY_SOURCES, source, content);
}

/**
 * traceMappings is only called on the root level SourceMapTree, and begins the process of
 * resolving each mapping in terms of the original source files.
 */
export function traceMappings(tree: MapSource): GenMapping {
  const gen = new GenMapping({ file: tree.map.file });
  const { sources: rootSources, map } = tree;
  const rootNames = map.names;
  const rootMappings = decodedMappings(map);

  for (let i = 0; i < rootMappings.length; i++) {
    const segments = rootMappings[i];

    let lastSource = null;
    let lastSourceLine = null;
    let lastSourceColumn = null;

    for (let j = 0; j < segments.length; j++) {
      const segment = segments[j];
      const genCol = segment[0];
      let traced: SourceMapSegmentObject | null = SOURCELESS_MAPPING;

      // 1-length segments only move the current generated column, there's no source information
      // to gather from it.
      if (segment.length !== 1) {
        const source = rootSources[segment[1]];
        traced = originalPositionFor(
          source,
          segment[2],
          segment[3],
          segment.length === 5 ? rootNames[segment[4]] : ''
        );

        // If the trace is invalid, then the trace ran into a sourcemap that doesn't contain a
        // respective segment into an original source.
        if (traced == null) continue;
      }

      // So we traced a segment down into its original source file. Now push a
      // new segment pointing to this location.
      const { column, line, name, content, source } = traced;
      if (line === lastSourceLine && column === lastSourceColumn && source === lastSource) {
        continue;
      }
      lastSourceLine = line;
      lastSourceColumn = column;
      lastSource = source;

      // Sigh, TypeScript can't figure out source/line/column are either all null, or all non-null...
      (addSegment as any)(gen, i, genCol, source, line, column, name);
      if (content != null) setSourceContent(gen, source, content);
    }
  }

  return gen;
}

/**
 * originalPositionFor is only called on children SourceMapTrees. It recurses down into its own
 * child SourceMapTrees, until we find the original source map.
 */
export function originalPositionFor(
  source: Sources,
  line: number,
  column: number,
  name: string
): SourceMapSegmentObject | null {
  if (!source.map) {
    return { column, line, name, source: source.source, content: source.content };
  }

  const segment = traceSegment(source.map, line, column);

  // If we couldn't find a segment, then this doesn't exist in the sourcemap.
  if (segment == null) return null;
  // 1-length segments only move the current generated column, there's no source information
  // to gather from it.
  if (segment.length === 1) return SOURCELESS_MAPPING;

  return originalPositionFor(
    source.sources[segment[1]],
    segment[2],
    segment[3],
    segment.length === 5 ? source.map.names[segment[4]] : name
  );
}
