import type { SequenceStepResult } from './measurement'
import { expect, it } from 'vitest'
import { createFrameworkResourceSequence } from './frameworkSequence'
import { assertResourceSequence, summarizeResourceSequence } from './resourceSequence'

function samples(): SequenceStepResult[] {
  return Array.from({ length: 19 }, (_, step) => ({
    step,
    label: `step-${step}`,
    status: 'passed' as const,
    measurement: {
      elapsedMs: 1,
      process: { memory: { rss: 100, heapUsed: 50, heapTotal: 100, external: 0, arrayBuffers: 0 }, resources: { Timer: 1 }, processListeners: { exit: 1 } },
      processTree: { rssBytes: 100, processCount: 1, observationMs: 1 },
      gc: { count: 1, durationMs: 1, forced: true, observationMs: 1 },
      session: { watchers: 1, engines: 1 },
      build: { loadCalls: 1, loadedModules: ['page.vue'], transformCalls: 1, transformedModules: ['page.vue'], publications: 1, outputFiles: ['page.js'], outputBytes: 10, patches: 0, patchBytes: 0 },
    },
  }))
}

it('requires observations for the complete process tree and post-GC heap', () => {
  const complete = samples()
  expect(() => assertResourceSequence(summarizeResourceSequence(complete))).not.toThrow()
  delete complete[0]!.measurement!.processTree
  expect(() => summarizeResourceSequence(complete)).toThrow('process-tree RSS')
})

it('does not let a stable parent RSS hide retained child or session growth', () => {
  const tree = samples()
  for (const sample of tree.slice(7)) {
    sample.measurement!.processTree!.rssBytes += 64 * 1024 * 1024
  }
  expect(() => assertResourceSequence(summarizeResourceSequence(tree))).toThrow('processTreeRss')
  const listeners = samples()
  for (const sample of listeners.slice(7)) {
    sample.measurement!.process.processListeners.exit = 2
  }
  expect(() => assertResourceSequence(summarizeResourceSequence(listeners))).toThrow('listener:exit')
})

it('builds a bounded 512-entry full-framework fixture with one stable hot source', () => {
  const sequence = createFrameworkResourceSequence()
  const app = JSON.parse(sequence.files['src/app.json']!) as { pages: string[] }
  expect(app.pages).toHaveLength(512)
  expect(app.pages.every(route => Object.hasOwn(sequence.files, `src/${route}.vue`))).toBe(true)
  expect(new Set(sequence.steps.map(step => 'file' in step.action ? step.action.file : '')).size).toBe(1)
  expect(() => createFrameworkResourceSequence(13)).toThrow()
  expect(() => createFrameworkResourceSequence(14, 513)).toThrow()
})
