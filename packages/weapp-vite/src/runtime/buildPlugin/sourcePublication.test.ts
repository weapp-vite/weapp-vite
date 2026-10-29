import type { HmrProfileProvenance } from '../../utils/hmrProfile/provenance'
import { describe, expect, it } from 'vitest'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { compilerNativeScriptVersion, readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { HmrSourcePublicationOwner } from '../hmrRuntimeSession/sourcePublication'
import { beginClassicSourcePublication } from './sourcePublication'

function setup() {
  const inputOwner = {}
  const sourceFile = compilerSourceId('src/page.ts')
  const sourceOwner = new HmrSourcePublicationOwner()
  const outputGenerations = new Map<string, object>()
  let profile: HmrProfileProvenance & { eventId?: string } = {}
  let sequence = 0
  return {
    inputOwner,
    sourceOwner,
    outputGenerations,
    get profile() { return profile },
    replaceProfile() { profile = { ...profile } },
    observe(source: string, eventId: string) {
      return sourceOwner.observe({ root: 'output', file: sourceFile, version: compilerNativeScriptVersion(source), eventId, event: 'update', receivedAtMs: 1 })!
    },
    begin() {
      return beginClassicSourcePublication({ inputOwner, sourceOwner, outputRoot: 'output', outputGenerations, profile: () => profile, buildId: `session:${++sequence}`, batchId: () => `batch:${sequence}` })
    },
  }
}

describe('classic source publication build', () => {
  it('keeps a source saved after native commit pending even if an after-write reader returns the same bytes', async () => {
    const fixture = setup()
    const build = fixture.begin()
    let late: ReturnType<typeof fixture.observe> | undefined
    await build.run(async () => {
      await readCompilerInput(fixture.inputOwner, compilerSourceId('src/page.ts'), async () => 'A')
      fixture.outputGenerations.set('output', {})
      late = fixture.observe('A', 'source-after-write')
      await readCompilerInput(fixture.inputOwner, late.file, async () => 'A')
    })
    build.finish(true)
    expect(fixture.profile.sourceEvents).toEqual([])
    expect(fixture.sourceOwner.capture('output')).toEqual([late])
    const retry = fixture.begin()
    await retry.run(async () => {
      await readCompilerInput(fixture.inputOwner, late!.file, async () => 'A')
      fixture.outputGenerations.set('output', {})
    })
    retry.finish(true)
    expect(fixture.sourceOwner.capture('output')).toEqual([])
  })

  it('exposes the inherited cold build identity before native write and acknowledges only after END', async () => {
    const fixture = setup()
    const token = fixture.observe('Page({ value: "A" })', 'source-A')
    const cold = fixture.begin()
    expect(fixture.profile.buildId).toBe('session:1')
    expect(fixture.profile.batchId).toBe('batch:1')
    expect(fixture.profile.sourceEvents).toEqual([])
    await cold.run(async () => {
      await readCompilerInput(fixture.inputOwner, token.file, async () => 'Page({ value: "A" })')
      fixture.replaceProfile()
      expect(fixture.profile.sourceEvents).toEqual([token.event])
      expect(fixture.profile.buildId).toBe('session:1')
      fixture.outputGenerations.set('output', {})
    })
    expect(fixture.sourceOwner.capture('output')).toEqual([token])
    cold.finish(true)
    expect(fixture.sourceOwner.capture('output')).toEqual([])
  })

  it.each(['native-write', 'formal-END'] as const)('retains a source after %s failure and completes its retry', async (failure) => {
    const fixture = setup()
    const token = fixture.observe('A', 'source-A')
    const first = fixture.begin()
    const run = first.run(async () => {
      await readCompilerInput(fixture.inputOwner, token.file, async () => 'A')
      fixture.outputGenerations.set('output', {})
      if (failure === 'native-write') {
        throw new Error('native publication failed')
      }
    })
    if (failure === 'native-write') {
      await expect(run).rejects.toThrow('native publication failed')
    }
    else {
      await run
    }
    first.finish(false)
    expect(fixture.sourceOwner.capture('output')).toEqual([token])
    const retry = fixture.begin()
    await retry.run(async () => {
      await readCompilerInput(fixture.inputOwner, token.file, async () => 'A')
      fixture.outputGenerations.set('output', {})
    })
    retry.finish(true)
    expect(fixture.profile.buildId).toBe('session:2')
    expect(fixture.sourceOwner.capture('output')).toEqual([])
  })

  it('rejects stale or missing native commit proof', async () => {
    const fixture = setup()
    const token = fixture.observe('A', 'source-A')
    fixture.outputGenerations.set('output', {})
    const build = fixture.begin()
    await build.run(async () => {
      await readCompilerInput(fixture.inputOwner, token.file, async () => 'A')
      fixture.outputGenerations.set('other-output', {})
    })
    build.finish(true)
    expect(fixture.sourceOwner.capture('output')).toEqual([token])
  })

  it('releases an old asynchronous input observer before the replacement context reads B', async () => {
    const fixture = setup()
    const a = fixture.observe('A', 'source-A')
    const previous = fixture.begin()
    const barrier = Promise.withResolvers<string>()
    const lateRead = previous.run(async () => readCompilerInput(fixture.inputOwner, a.file, () => barrier.promise))
    previous.finish(false)
    const b = fixture.observe('B', 'source-B')
    const replacement = fixture.begin()
    await replacement.run(async () => {
      await readCompilerInput(fixture.inputOwner, b.file, async () => 'B')
      barrier.resolve('A')
      await lateRead
      expect(fixture.profile.sourceEvents).toEqual([b.event])
      fixture.outputGenerations.set('output', {})
    })
    replacement.finish(true)
    expect(fixture.sourceOwner.capture('output')).toEqual([])
  })

  it('drains normal successful A, equal-length B and BASE publications without extra source events', async () => {
    const fixture = setup()
    for (const source of ['BASE', 'A', 'B', 'BASE']) {
      const token = fixture.observe(source, `source-${source}`)
      const build = fixture.begin()
      await build.run(async () => {
        await readCompilerInput(fixture.inputOwner, token.file, async () => source)
        fixture.outputGenerations.set('output', {})
      })
      build.finish(true)
      expect(fixture.profile.sourceEvents).toEqual([token.event])
      expect(fixture.sourceOwner.capture('output')).toEqual([])
    }
  })
})
