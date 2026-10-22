import type { HmrReport } from './hmrSamples'
import { expect, it } from 'vitest'
import { PartialHmrCollectionError, readHmrSamples } from './hmrSamples'

function report(): HmrReport {
  const cycle = { edit: { wallMs: 10, phase: 'edit' }, restore: { wallMs: 20, phase: 'restore' } }
  return { templates: [{ id: 'native', scenarios: [
    { id: 'template', samples: [cycle.edit, cycle.edit], cycles: [cycle, cycle] },
    { id: 'sitemap', samples: [], error: 'output did not update' },
  ] }] }
}

it('retains four completed phases without inventing values for a failed sibling', () => {
  let error: unknown
  try {
    readHmrSamples(report(), 'classic')
  }
  catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(PartialHmrCollectionError)
  const partial = error as PartialHmrCollectionError
  expect(partial.message).toContain('native/sitemap: output did not update')
  expect(partial.samples.map(value => value.phase)).toEqual(['first:edit', 'first:restore', 'repeat:edit', 'repeat:restore'])
  expect(partial.samples.every(value => value.id.includes(':template:') && value.ms > 0)).toBe(true)
})

it('does not accept invalid observations as valid samples', () => {
  const input = report()
  input.templates[0]!.scenarios[0]!.cycles![0]!.edit.wallMs = Number.NaN
  try {
    readHmrSamples(input, 'classic')
    expect.unreachable()
  }
  catch (error) {
    expect(error).toBeInstanceOf(PartialHmrCollectionError)
    expect((error as PartialHmrCollectionError).samples.every(value => Number.isFinite(value.ms))).toBe(true)
  }
})

it('keeps the requested mode separate from actual fallback pipelines and missing timing', () => {
  const edit = { wallMs: 10, phase: 'edit', profileStatus: 'missing', timingSource: 'output-observation', runtimeBefore: 'stateful' as const, runtimeAfter: 'standard' as const }
  const restore = { wallMs: 20, phase: 'restore', profileStatus: 'available', timingSource: 'compiler-profile', totalMs: 15, pipeline: 'standard' as const, runtimeBefore: 'standard' as const, runtimeAfter: 'standard' as const }
  const cycle = { edit, restore }
  const values = readHmrSamples({ templates: [{ id: 'native', scenarios: [{ id: 'app-json', samples: [edit, edit], cycles: [cycle, cycle] }] }] }, 'stateful-experimental')
  expect(values).toHaveLength(4)
  expect(values[0]).toMatchObject({ requestedRuntime: 'stateful-experimental', runtimeBefore: 'stateful', runtimeAfter: 'standard', profileStatus: 'missing' })
  expect(values[0]?.profile).toBeUndefined()
  expect(values[0]?.profilePipeline).toBeUndefined()
  expect(values[1]).toMatchObject({ requestedRuntime: 'stateful-experimental', runtimeBefore: 'standard', runtimeAfter: 'standard', profilePipeline: 'standard', profileStatus: 'available', profile: { totalMs: 15 } })
  expect(values.every(value => value.id.startsWith('hmr:stateful-experimental:'))).toBe(true)
})
