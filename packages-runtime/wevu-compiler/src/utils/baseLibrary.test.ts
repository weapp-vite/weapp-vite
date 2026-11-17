import { describe, expect, it } from 'vitest'
import { consumeBaseLibraryHint, createBaseLibraryCompileContext, createBaseLibraryHintState, isBaseLibraryVersionSatisfied } from './baseLibrary'

describe('isBaseLibraryVersionSatisfied', () => {
  it.each(['2.26.1', '2.32.3', '3.10.2', ' v2.26.1 ', 'V3.17.2'])('accepts %j', (version) => {
    expect(isBaseLibraryVersionSatisfied(version, '2.26.1')).toBe(true)
  })

  it.each([undefined, '', 'latest', 'trial', 'widelyUsed', '2.26.1-beta', '2.25.2', '2.26.0'])('rejects %j', (version) => {
    expect(isBaseLibraryVersionSatisfied(version, '2.26.1')).toBe(false)
  })
})

describe('consumeBaseLibraryHint', () => {
  const request = (topic: string) => ({ topic, minimum: '2.26.1' })

  it('skips the hint when the version satisfies the minimum', () => {
    const context = createBaseLibraryCompileContext({ version: '2.26.1' })
    expect(consumeBaseLibraryHint(context, request('feature'))).toBe(false)
  })

  it('de-duplicates within one file without shared state', () => {
    const context = createBaseLibraryCompileContext({ version: '2.25.2' })
    expect(consumeBaseLibraryHint(context, request('feature'))).toBe(true)
    expect(consumeBaseLibraryHint(context, request('feature'))).toBe(false)
  })

  it('de-duplicates across files through shared state', () => {
    const hintState = createBaseLibraryHintState()
    const first = createBaseLibraryCompileContext({ version: '2.25.2', hintState })
    const second = createBaseLibraryCompileContext({ version: '2.25.2', hintState })
    expect(consumeBaseLibraryHint(first, request('feature'))).toBe(true)
    expect(consumeBaseLibraryHint(second, request('feature'))).toBe(false)
  })

  it('keeps different topics independent', () => {
    const hintState = createBaseLibraryHintState()
    const context = createBaseLibraryCompileContext({ version: '2.25.2', hintState })
    expect(consumeBaseLibraryHint(context, request('first'))).toBe(true)
    expect(consumeBaseLibraryHint(context, request('second'))).toBe(true)
    expect([...hintState.reported]).toEqual(['first', 'second'])
  })
})
