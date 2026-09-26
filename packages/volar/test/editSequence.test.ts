import type { SequenceInput } from '../../../scripts/editSequence/driver'
import { describe, expect, it } from 'vitest'
import { EditSequenceDivergence, firstDifference, verifyEditSequence } from '../../../scripts/editSequence/driver'
import { EditorSequenceSession } from '../../../scripts/editSequence/editor'
import { editorSource, positionDriftSequence } from '../../../scripts/editSequence/scenarios'

function editorObserver() {
  const session = new EditorSequenceSession()
  return {
    name: 'volar',
    incremental: async ({ files }: { files: Readonly<Record<string, string>> }) => session.observe(files),
    fresh: async ({ files }: { files: Readonly<Record<string, string>> }) => new EditorSequenceSession().observe(files),
    close: async () => {},
  }
}

interface ScriptSetupSnapshot {
  blocks: { scriptSetup: { loc: { end: { line: number } } } }
}

function stalePositionObserver() {
  const observer = editorObserver()
  let previousEndLine: number | undefined
  return {
    ...observer,
    incremental: async (input: SequenceInput) => {
      const snapshot = await observer.incremental(input)
      const end = (snapshot.files['page.vue'] as ScriptSetupSnapshot).blocks.scriptSetup.loc.end
      const currentEndLine = end.line
      // 保留上一轮坐标来复现已知失效模式；不要求生产 parser 的缺陷持续存在。
      if (previousEndLine !== undefined) {
        end.line = previousEndLine
      }
      previousEndLine = currentEndLine
      return snapshot
    },
  }
}

describe('editor edit-sequence detector', () => {
  it('rejects replayable stale block coordinates independently of parser fixes', async () => {
    let failure: unknown
    try {
      await verifyEditSequence(positionDriftSequence, stalePositionObserver())
    }
    catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(EditSequenceDivergence)
    const divergence = failure as EditSequenceDivergence
    expect(divergence.step).toBe(1)
    expect(divergence.difference).toEqual({
      file: 'page.vue',
      field: 'files.page.vue.blocks.scriptSetup.loc.end.line',
      incremental: 3,
      fresh: 4,
    })
    expect(divergence.replay).toEqual(positionDriftSequence)
    await expect(verifyEditSequence(divergence.replay, stalePositionObserver())).rejects.toMatchObject({
      step: divergence.step,
      difference: divergence.difference,
    })
  })

  it('keeps independent content/rename/delete sequences runnable despite the known negative case', async () => {
    await verifyEditSequence({
      name: 'editor-content-topology',
      files: { 'page.vue': editorSource },
      steps: [
        { name: 'same-width content update', action: { kind: 'write', file: 'page.vue', content: editorSource.replace('one', 'two') } },
        { name: 'rename', action: { kind: 'rename', file: 'page.vue', to: 'other.vue' } },
        { name: 'delete', action: { kind: 'delete', file: 'other.vue' } },
        { name: 'recreate', action: { kind: 'write', file: 'page.vue', content: editorSource } },
      ],
    }, editorObserver())
  })

  it('does not discard changed diagnostic positions, missing files, or dependency edges', () => {
    const snapshot = { files: { 'page.vue': { diagnostics: [{ code: 'WV1001', loc: { start: { line: 2, column: 3, offset: 7 } } }], dependencies: ['./theme.css'] } } }
    const changed = structuredClone(snapshot)
    changed.files['page.vue'].diagnostics[0]!.loc.start.column = 4
    expect(firstDifference(snapshot, changed)?.field).toBe('files.page.vue.diagnostics.0.loc.start.column')
    expect(firstDifference(snapshot, { files: {} })?.file).toBe('page.vue')
    const missingDependency = structuredClone(snapshot)
    missingDependency.files['page.vue'].dependencies = []
    expect(firstDifference(snapshot, missingDependency)?.field).toBe('files.page.vue.dependencies.0')
  })

  it('rejects oversized rapid histories and writes through workspace package links before observing', async () => {
    await expect(verifyEditSequence({
      name: 'bounded-rapid',
      files: {},
      steps: [{ name: 'oversized burst', action: { kind: 'rapid', saves: Array.from({ length: 17 }, () => ({ kind: 'write' as const, file: 'page.vue', content: editorSource })) } }],
    }, editorObserver())).rejects.toThrow('rapid saves')
    await expect(verifyEditSequence({
      name: 'workspace-write-boundary',
      files: {},
      steps: [{ name: 'unsafe replay path', action: { kind: 'write', file: 'node_modules/wevu/src/index.ts', content: 'replaced' } }],
    }, editorObserver())).rejects.toThrow('fixture-owned')
  })
})
