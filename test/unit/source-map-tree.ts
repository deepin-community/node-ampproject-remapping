import { decodedMap } from '@jridgewell/gen-mapping';
import { TraceMap } from '@jridgewell/trace-mapping';

import {
  OriginalSource,
  MapSource,
  originalPositionFor,
  traceMappings,
} from '../../src/source-map-tree';
import type { DecodedSourceMap } from '../../src/types';

describe('MapSource', () => {
  describe('traceMappings()', () => {
    const sourceRoot = 'foo';
    const baseMap: DecodedSourceMap = {
      mappings: [],
      names: ['name'],
      sourceRoot,
      sources: ['child.js'],
      version: 3,
    };
    const child = MapSource(
      new TraceMap({
        mappings: [
          [
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [2, 0, 0, 0],
            [4, 0, 1, 1],
          ], // line 0
          [[1, 0, 0, 0, 0], [6]], // line 1
        ],
        names: ['child'],
        sources: ['original.js'],
        version: 3,
      }),
      [OriginalSource(`${sourceRoot}/original.js`, '')]
    );

    test('records segment if segment is 1-length', () => {
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [[[0, 0, 0, 4], [5]]],
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced.mappings).toEqual([[[0, 0, 1, 1], [5]]]);
    });

    test('records segment if trace hits 1-length segment', () => {
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [
          [
            [0, 0, 0, 4],
            [5, 0, 1, 6],
          ],
        ],
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced.mappings).toEqual([[[0, 0, 1, 1], [5]]]);
    });

    test('skips segment if trace returns null', () => {
      const sourceIndex = 0;
      const line = 10; // There is no line 10 in child's mappings.
      const column = 0;
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [[[0, sourceIndex, line, column]]],
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced.mappings).toEqual([]);
    });

    test('traces name if segment is 5-length', () => {
      const sourceIndex = 0;
      const line = 0;
      const column = 0;
      const nameIndex = 0;
      const name = 'name';
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [[[0, sourceIndex, line, column, nameIndex]]],
        names: [name],
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced.mappings).toEqual([[[0, 0, 0, 0, 0]]]);
      expect(traced).toMatchObject({
        names: [name],
      });
    });

    test('maps into traced segment', () => {
      const sourceIndex = 0;
      const line = 0;
      const column = 4;
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [[[0, sourceIndex, line, column]]],
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced.mappings).toEqual([[[0, 0, 1, 1]]]);
    });

    test('maps into traced segment with name', () => {
      const sourceIndex = 0;
      const line = 1;
      const column = 1;
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [[[0, sourceIndex, line, column]]],
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced.mappings).toEqual([[[0, 0, 0, 0, 0]]]);
      expect(traced).toMatchObject({
        names: ['child'],
      });
    });

    test('defaults decoded return map with original data', () => {
      const extras = {
        file: 'foobar.js',
        // TODO: support sourceRoot
        // sourceRoot: 'https://foobar.com/',
      };
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [],
        ...extras,
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced).toMatchObject(extras);
    });

    test('resolves source files realtive to sourceRoot', () => {
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [[[0, 0, 0, 0]]],
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced).toMatchObject({
        // TODO: support sourceRoot
        sourceRoot: undefined,
        sources: ['foo/original.js'],
      });
    });

    test('truncates mappings to the last line with segment', () => {
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [[[0, 0, 0, 0]], [], []],
        sourceRoot,
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced.mappings).toEqual([[[0, 0, 0, 0]]]);
    });

    test('truncates empty mappings', () => {
      const map: DecodedSourceMap = {
        ...baseMap,
        mappings: [[], [], []],
        sourceRoot,
      };

      const tree = MapSource(new TraceMap(map), [child]);
      const traced = decodedMap(traceMappings(tree));
      expect(traced.mappings).toEqual([]);
    });

    describe('redundant segments', () => {
      it('skips redundant segments on the same line', () => {
        const map: DecodedSourceMap = {
          ...baseMap,
          mappings: [
            [
              [0, 0, 0, 0],
              [1, 0, 0, 0],
            ],
          ],
        };

        const tree = MapSource(new TraceMap(map), [child]);
        const traced = decodedMap(traceMappings(tree));
        expect(traced.mappings).toEqual([[[0, 0, 0, 0]]]);
      });

      it('keeps redundant segments on another line', () => {
        const map: DecodedSourceMap = {
          ...baseMap,
          mappings: [[[0, 0, 0, 0]], [[0, 0, 0, 0]]],
        };

        const tree = MapSource(new TraceMap(map), [child]);
        const traced = decodedMap(traceMappings(tree));
        expect(traced.mappings).toEqual([[[0, 0, 0, 0]], [[0, 0, 0, 0]]]);
      });
    });
  });

  describe('originalPositionFor()', () => {
    const map: DecodedSourceMap = {
      mappings: [
        [
          [0, 0, 0, 0],
          [1, 0, 0, 0],
          [2, 0, 0, 0],
          [4, 0, 1, 1],
        ], // line 0
        [[2, 0, 0, 0]], // line 1 - maps to line 0 col 0
        [[0]], // line 2 has 1 length segment
        [[0, 0, 0, 0, 0]], // line 3 has a name
        [
          [0, 0, 4, 0],
          [5, 0, 4, 6],
        ], // line 4 is identical to line 4 of source except col 5 was removed eg 01234567890 -> 012346789
        [[0, 0, 5, 0], [5], [6, 0, 5, 5]], // line 4 is identical to line 4 of source except a char was added at col 5 eg 01234*56789 -> 0123*456789
      ],
      names: ['name'],
      sources: ['child.js'],
      version: 3,
    };
    const tree = MapSource(new TraceMap(map), [OriginalSource('child.js', '')]);

    test('traces LineSegments to the segment with matching generated column', () => {
      const trace = originalPositionFor(tree, 0, 4, '');
      expect(trace).toMatchObject({ line: 1, column: 1 });
    });

    test('traces all generated cols on a line back to their source when source had characters removed', () => {
      const expectedCols = [0, 0, 0, 0, 0, 6, 6, 6, 6];
      for (let genCol = 0; genCol < expectedCols.length; genCol++) {
        const trace = originalPositionFor(tree, 4, genCol, '');
        expect(trace).toMatchObject({ line: 4, column: expectedCols[genCol] });
      }
    });

    test('traces all generated cols on a line back to their source when source had characters added', () => {
      const expectedCols = [0, 0, 0, 0, 0, null, 5, 5, 5, 5, 5];
      for (let genCol = 0; genCol < expectedCols.length; genCol++) {
        const trace = originalPositionFor(tree, 5, genCol, '');
        if (expectedCols[genCol] == null) {
          expect(trace).toMatchObject({ source: null });
        } else {
          expect(trace).toMatchObject({ line: 5, column: expectedCols[genCol] });
        }
      }
    });

    test('returns null if line is longer than mapping lines', () => {
      const trace = originalPositionFor(tree, 10, 0, '');
      expect(trace).toBe(null);
    });

    test('returns null if no matching segment column', () => {
      //line 1 col 0 of generated doesn't exist in the original source
      const trace = originalPositionFor(tree, 1, 0, '');
      expect(trace).toBe(null);
    });

    test('returns sourceless segment object if segment is 1-length', () => {
      const trace = originalPositionFor(tree, 2, 0, '');
      expect(trace).toMatchObject({ source: null });
    });

    test('passes in outer name to trace', () => {
      const trace = originalPositionFor(tree, 0, 0, 'foo');
      expect(trace).toMatchObject({ name: 'foo' });
    });

    test('overrides name if segment is 5-length', () => {
      const trace = originalPositionFor(tree, 3, 0, 'foo');
      expect(trace).toMatchObject({ name: 'name' });
    });

    describe('tracing same line multiple times', () => {
      describe('later column', () => {
        test('returns matching segment after match', () => {
          expect(originalPositionFor(tree, 0, 1, '')).not.toBe(null);
          const trace = originalPositionFor(tree, 0, 4, '');
          expect(trace).toMatchObject({ line: 1, column: 1 });
        });

        test('returns matching segment after null match', () => {
          expect(originalPositionFor(tree, 1, 0, '')).toBe(null);
          const trace = originalPositionFor(tree, 1, 2, '');
          expect(trace).toMatchObject({ line: 0, column: 0 });
        });

        test('returns null segment segment after null match', () => {
          expect(originalPositionFor(tree, 1, 0, '')).toBe(null);
          const trace = originalPositionFor(tree, 1, 1, '');
          expect(trace).toBe(null);
        });

        test('returns matching segment after almost match', () => {
          expect(originalPositionFor(tree, 4, 2, '')).not.toBe(null);
          const trace = originalPositionFor(tree, 4, 5, '');
          expect(trace).toMatchObject({ line: 4, column: 6 });
        });
      });

      describe('earlier column', () => {
        test('returns matching segment after match', () => {
          expect(originalPositionFor(tree, 0, 4, '')).not.toBe(null);
          const trace = originalPositionFor(tree, 0, 1, '');
          expect(trace).toMatchObject({ line: 0, column: 0 });
        });

        test('returns null segment segment after null match', () => {
          expect(originalPositionFor(tree, 1, 1, '')).toBe(null);
          const trace = originalPositionFor(tree, 1, 0, '');
          expect(trace).toBe(null);
        });

        test('returns matching segment after almost match', () => {
          expect(originalPositionFor(tree, 4, 2, '')).not.toBe(null);
          const trace = originalPositionFor(tree, 4, 0, '');
          expect(trace).toMatchObject({ line: 4, column: 0 });
        });
      });
    });
  });
});
