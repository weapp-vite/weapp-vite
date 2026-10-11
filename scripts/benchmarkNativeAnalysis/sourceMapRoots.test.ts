import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { captureArtifacts } from './artifacts'
import { canonicalSourceMapRoots } from './sourceMapRoots'

describe('cross-checkout sourcemap evidence', () => {
  it('compares only known source roots and preserves original emitted maps', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'map-roots-'))
    try {
      const project = path.join(root, 'project')
      const output = path.join(project, 'dist')
      const mapFile = path.join(output, 'app.js.map')
      await mkdir(output, { recursive: true })
      await writeFile(path.join(output, 'app.json'), '{"pages":["index"]}')
      await writeFile(path.join(output, 'app.js'), 'console.log(1)')
      const makeMap = (variant: string) => ({
        version: 3,
        file: 'app.js',
        names: ['value'],
        sources: ['../src/app.ts', `../../${variant}/runtime.ts`, '../../external/library.ts', 'virtual:module'],
        sourcesContent: ['const value = 1', 'runtime()', 'external()', null],
        mappings: 'AAAA,CAAC',
      })
      const a = makeMap('baseline')
      const b = makeMap('candidate')
      const rootsA = [project, path.join(root, 'baseline')]
      const rootsB = [project, path.join(root, 'candidate')]
      expect(canonicalSourceMapRoots(a, mapFile, rootsA)).toEqual(canonicalSourceMapRoots(b, mapFile, rootsB))
      expect(canonicalSourceMapRoots(a, mapFile, rootsA).sources).toEqual([
        '<source-root:0>/src/app.ts',
        '<source-root:1>/runtime.ts',
        '../../external/library.ts',
        'virtual:module',
      ])
      await writeFile(mapFile, JSON.stringify(a))
      const rawA = await captureArtifacts(output, rootsA)
      const retained = path.join(root, 'retained')
      const canonicalA = await captureArtifacts(output, rootsA, retained, true)
      expect(await readFile(path.join(retained, 'app.js.map'), 'utf8')).toBe(JSON.stringify(a))
      await writeFile(mapFile, JSON.stringify(b))
      expect((await captureArtifacts(output, rootsB)).digest).not.toBe(rawA.digest)
      expect((await captureArtifacts(output, rootsB, undefined, true)).digest).toBe(canonicalA.digest)
      for (const mutation of [
        { ...b, mappings: 'AACA,CAAC' },
        { ...b, names: ['changed'] },
        { ...b, sourcesContent: ['different', ...b.sourcesContent.slice(1)] },
        { ...b, sources: ['../src/other.ts', ...b.sources.slice(1)] },
        { ...b, sources: [...b.sources.slice(0, 2), '../../external/other.ts', 'virtual:module'] },
      ]) {
        await writeFile(mapFile, JSON.stringify(mutation))
        expect((await captureArtifacts(output, rootsB, undefined, true)).digest).not.toBe(canonicalA.digest)
      }
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails closed for unhandled source roots and keeps root ownership distinct', () => {
    const root = path.resolve('fixture')
    const mapFile = path.join(root, 'project/dist/app.js.map')
    const roots = [path.join(root, 'project'), root]
    expect(canonicalSourceMapRoots({ sources: ['../src/a.ts', '../../src/a.ts'] }, mapFile, roots).sources).toEqual([
      '<source-root:0>/src/a.ts',
      '<source-root:1>/src/a.ts',
    ])
    expect(() => canonicalSourceMapRoots({ sources: [null] }, mapFile, roots)).toThrow('string sourcemap sources')
    expect(() => canonicalSourceMapRoots({ sourceRoot: '../src', sources: ['a.ts'] }, mapFile, roots)).toThrow('empty sourcemap sourceRoot')
  })
})
