import { describe, expect, it } from 'vitest'
import { HmrSourcePublicationOwner } from './sourcePublication'

function observe(owner: HmrSourcePublicationOwner, version: string, options: { root?: string, file?: string, eventId?: string } = {}) {
  return owner.observe({ root: options.root ?? 'output', file: options.file ?? 'src/page.ts', version, eventId: options.eventId ?? version, event: 'update', receivedAtMs: 1 })!
}

function complete(owner: HmrSourcePublicationOwner, version: string) {
  const build = owner.begin('output')
  build.recordInput('src/page.ts', version)
  build.markCommitted()
  build.finish(true)
  return build
}

describe('command source publication ownership', () => {
  it('adopts a save observed after cold begin only when its exact input is subsequently consumed', () => {
    const owner = new HmrSourcePublicationOwner()
    const cold = owner.begin('output')
    const token = observe(owner, 'A')
    cold.recordInput(token.file, 'A')
    expect(cold.sourceEvents).toEqual([token.event])
    cold.markCommitted()
    cold.finish(true)
    expect(owner.capture('output')).toEqual([])
  })

  it('does not retroactively match a save observed after the last compiler input', () => {
    const owner = new HmrSourcePublicationOwner()
    const cold = owner.begin('output')
    cold.recordInput('src/page.ts', 'A')
    const token = observe(owner, 'A')
    cold.markCommitted()
    cold.finish(true)
    expect(cold.sourceEvents).toEqual([])
    expect(owner.capture('output')).toEqual([token])
  })

  it('requires exact consumed input, successful native commit and formal END', () => {
    const owner = new HmrSourcePublicationOwner()
    const token = observe(owner, 'A')
    const missingInput = owner.begin('output')
    missingInput.markCommitted()
    missingInput.finish(true)
    expect(owner.capture('output')).toEqual([token])
    const missingCommit = owner.begin('output')
    missingCommit.recordInput(token.file, 'A')
    missingCommit.finish(true)
    expect(owner.capture('output')).toEqual([token])
    const failedEnd = owner.begin('output')
    failedEnd.recordInput(token.file, 'A')
    failedEnd.markCommitted()
    failedEnd.finish(false)
    failedEnd.finish(true)
    expect(owner.capture('output')).toEqual([token])
    expect(complete(owner, 'A').sourceEvents).toEqual([token.event])
    expect(owner.capture('output')).toEqual([])
  })

  it('keeps a newer save when an older build finishes, including equal-length and ABA updates', () => {
    const owner = new HmrSourcePublicationOwner()
    const a = observe(owner, 'A')
    const oldBuild = owner.begin('output')
    oldBuild.recordInput(a.file, 'A')
    const b = observe(owner, 'B')
    oldBuild.markCommitted()
    oldBuild.finish(true)
    expect(owner.capture('output')).toEqual([b])
    const bBuild = owner.begin('output')
    bBuild.recordInput(b.file, 'B')
    const restored = observe(owner, 'A', { eventId: 'restore' })
    expect(restored).not.toBe(a)
    bBuild.markCommitted()
    bBuild.finish(true)
    expect(owner.capture('output')).toEqual([restored])
    complete(owner, 'A')
    expect(owner.capture('output')).toEqual([])
  })

  it('does not invent completion for changed or unstable compiler inputs', () => {
    const owner = new HmrSourcePublicationOwner()
    const token = observe(owner, 'A')
    const mismatch = owner.begin('output')
    mismatch.recordInput(token.file, 'B')
    mismatch.markCommitted()
    mismatch.finish(true)
    expect(mismatch.sourceEvents).toEqual([])
    const unstable = owner.begin('output')
    unstable.recordInput(token.file, 'A')
    unstable.recordInput(token.file, 'B')
    unstable.recordInput(token.file, 'A')
    unstable.markCommitted()
    unstable.finish(true)
    expect(unstable.sourceEvents).toEqual([])
    expect(owner.capture('output')).toEqual([token])
  })

  it('deduplicates a pending notification and a late notification for a published version', () => {
    const owner = new HmrSourcePublicationOwner()
    const a = observe(owner, 'A')
    expect(observe(owner, 'A', { eventId: 'duplicate' })).toBe(a)
    complete(owner, 'A')
    expect(observe(owner, 'A', { eventId: 'late' })).toBeUndefined()
    const b = observe(owner, 'B')
    const restore = observe(owner, 'A', { eventId: 'restore' })
    expect(restore).not.toBeUndefined()
    expect(restore).not.toBe(b)
  })

  it('invalidates a deleted alias through its observed physical identity', () => {
    const owner = new HmrSourcePublicationOwner()
    owner.observe({ root: 'output', file: 'physical/page.ts', lexicalFile: 'alias/page.ts', version: 'A', event: 'update', eventId: 'alias-A', receivedAtMs: 1 })
    // 删除后 canonical 查询只剩 lexical 路径，不能因此留下旧 physical token。
    owner.invalidate('output', 'alias/page.ts')
    expect(owner.capture('output')).toEqual([])
  })

  it('forgets an old alias after the same lexical path becomes a regular source', () => {
    const owner = new HmrSourcePublicationOwner()
    const physical = owner.observe({ root: 'output', file: 'physical/page.ts', lexicalFile: 'alias/page.ts', version: 'A', event: 'update', eventId: 'physical-A', receivedAtMs: 1 })!
    owner.observe({ root: 'output', file: 'alias/page.ts', lexicalFile: 'alias/page.ts', version: 'B', event: 'create', eventId: 'regular-B', receivedAtMs: 2 })
    owner.invalidate('output', 'alias/page.ts')
    expect(owner.capture('output')).toEqual([physical])
  })

  it('gives recreation a fresh identity after deletion without claiming absence was compiled', () => {
    const owner = new HmrSourcePublicationOwner()
    const old = observe(owner, 'A')
    const previous = owner.begin('output')
    previous.recordInput(old.file, 'A')
    owner.invalidate('output', old.file)
    const recreated = owner.observe({ root: 'output', file: old.file, version: 'A', event: 'create', eventId: 'recreated-A', receivedAtMs: 2 })!
    previous.markCommitted()
    previous.finish(true)
    expect(recreated).not.toBe(old)
    expect(owner.capture('output')).toEqual([recreated])
    complete(owner, 'A')
    expect(owner.capture('output')).toEqual([])
  })

  it('retains read-only source eligibility only for received or successfully compiled command inputs', () => {
    const owner = new HmrSourcePublicationOwner()
    expect(owner.knowsSource('output', 'src/page.ts')).toBe(false)
    const cold = owner.begin('output')
    cold.recordInput('src/page.ts', 'BASE')
    cold.markCommitted()
    expect(owner.knowsSource('output', 'src/page.ts')).toBe(false)
    cold.finish(true)
    expect(owner.knowsSource('output', 'src/page.ts')).toBe(true)
    expect(owner.knowsSource('other-output', 'src/page.ts')).toBe(false)
    expect(owner.knowsSource('output', 'src/unrelated.ts')).toBe(false)
    expect(owner.capture('output')).toEqual([])
    const pending = observe(owner, 'A', { file: 'src/pending.ts' })
    expect(owner.knowsSource('output', pending.file)).toBe(true)
    owner.invalidate('output', pending.file)
    expect(owner.knowsSource('output', pending.file)).toBe(false)
    owner.close()
    expect(owner.knowsSource('output', 'src/page.ts')).toBe(false)
  })

  it.each(['native-commit', 'formal-END'] as const)('does not retain input eligibility after failed %s', (failure) => {
    const owner = new HmrSourcePublicationOwner()
    const build = owner.begin('output')
    build.recordInput('src/page.ts', 'A')
    if (failure === 'formal-END') {
      build.markCommitted()
    }
    build.finish(failure !== 'formal-END')
    expect(owner.knowsSource('output', 'src/page.ts')).toBe(false)
    expect(owner.capture('output')).toEqual([])
  })

  it('records the first committed baseline without requiring a source notification', () => {
    const owner = new HmrSourcePublicationOwner()
    complete(owner, 'BASE')
    expect(observe(owner, 'BASE')).toBeUndefined()
    expect(observe(owner, 'A')).not.toBeUndefined()
  })

  it('keeps roots and independent command owners isolated', () => {
    const owner = new HmrSourcePublicationOwner()
    const other = new HmrSourcePublicationOwner()
    const token = observe(owner, 'A')
    const otherRoot = owner.begin('other-output')
    otherRoot.recordInput(token.file, 'A')
    otherRoot.markCommitted()
    otherRoot.finish(true)
    complete(other, 'A')
    expect(owner.capture('output')).toEqual([token])
    expect(other.capture('output')).toEqual([])
    expect(owner.owns(token.event)).toBe(true)
    expect(other.owns(token.event)).toBe(false)
  })

  it('discards command metadata only at terminal close and ignores late completion', () => {
    const owner = new HmrSourcePublicationOwner()
    const token = observe(owner, 'A')
    const build = owner.begin('output')
    build.recordInput(token.file, 'A')
    owner.close()
    build.markCommitted()
    build.finish(true)
    owner.close()
    expect(owner.capture('output')).toEqual([])
    expect(observe(owner, 'B')).toBeUndefined()
  })
})
