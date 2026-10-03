import type { StatefulHmrOutputFile } from './outputWriter'
import { describe, expect, it } from 'vitest'
import { isBundlerDiagnosticAsset } from '../buildPlugin/outputBoundary'
import { isStatefulHmrSnapshotAsset, selectStatefulHmrAdditionalOutput } from './outputOwnership'

describe('stateful additional output ownership', () => {
  it('protects transformed assets while preserving executable modules and new assets', () => {
    const snapshot: StatefulHmrOutputFile[] = [
      { type: 'asset', fileName: 'components/leaf/index.json', source: '{"component":true}' },
      { type: 'asset', fileName: 'pages/empty/index.js', source: 'Page({});' },
      { type: 'chunk', fileName: 'pages/home/index.js', code: 'Page({});' },
    ]
    const executable: StatefulHmrOutputFile = { type: 'chunk', fileName: 'pages/empty/index.js', code: 'Page({ data: { ready: true } });' }
    const newAsset: StatefulHmrOutputFile = { type: 'asset', fileName: 'assets/new.svg', source: '<svg />' }
    const output: StatefulHmrOutputFile[] = [
      { type: 'asset', fileName: 'components/leaf/index.json', source: '{}' },
      { type: 'asset', fileName: 'pages/empty/index.js', source: '' },
      executable,
      newAsset,
    ]
    expect(selectStatefulHmrAdditionalOutput(output, snapshot)).toEqual([executable, newAsset])
    expect(output).toHaveLength(4)
  })

  it('does not give snapshot chunks ownership of additional assets', () => {
    const output: StatefulHmrOutputFile[] = [{ type: 'asset', fileName: 'worker.js', source: 'worker.onMessage(() => {});' }]
    const snapshot: StatefulHmrOutputFile[] = [{ type: 'chunk', fileName: 'worker.js', code: '' }]
    expect(selectStatefulHmrAdditionalOutput(output, snapshot)).toEqual(output)
  })

  it('keeps bundler analysis reports out of runtime snapshot ownership', () => {
    const report = {
      type: 'asset' as const,
      fileName: 'stats0.html',
      source: '<title>Rollup Visualizer</title>',
    }
    expect(isBundlerDiagnosticAsset(report)).toBe(true)
    expect(isStatefulHmrSnapshotAsset(report)).toBe(false)
    expect(isStatefulHmrSnapshotAsset({
      type: 'asset',
      fileName: 'assets/help.html',
      source: '<title>Help</title>',
    })).toBe(true)
  })
})
