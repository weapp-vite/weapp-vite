import { describe, expect, it } from 'vitest'
import { resolveTemplateRegistrationFallback } from './templateRegistration'

describe('compiled template capability admission', () => {
  const owner = 'src/pages/compiled/index.vue'
  const previous = new Map([[owner, 'compiled-template-before']])

  it('keeps a script or style update with the same compiled registration stateful', () => {
    expect(resolveTemplateRegistrationFallback(previous, {
      entryIds: [owner],
      templateRegistrationSignatures: new Map(previous),
    })).toBeUndefined()
  })

  it('requires classic before a changed inline or external template can be published', () => {
    expect(resolveTemplateRegistrationFallback(previous, {
      entryIds: [owner],
      templateRegistrationSignatures: new Map([[owner, 'compiled-template-after']]),
    })).toMatchObject({ code: 'native-registration', files: [owner] })
    expect(previous.get(owner)).toBe('compiled-template-before')
  })

  it.each([undefined, new Map<string, string | undefined>(), new Map([[owner, undefined]])])('rejects an unknown template contract (%j)', (current) => {
    expect(resolveTemplateRegistrationFallback(previous, { entryIds: [owner], templateRegistrationSignatures: current })?.code).toBe('native-registration')
    expect(resolveTemplateRegistrationFallback(current, { entryIds: [owner], templateRegistrationSignatures: previous })?.code).toBe('native-registration')
  })

  it('leaves independent native WXML and native registration entries outside this boundary', () => {
    expect(resolveTemplateRegistrationFallback(undefined, { entryIds: ['src/pages/native/index.ts'] })).toBeUndefined()
  })

  it.each(['jsx', 'tsx'])('rejects a missing %s compiler registration contract before publishing', (extension) => {
    const entry = `src/pages/compiled/index.${extension}`
    expect(resolveTemplateRegistrationFallback(undefined, { entryIds: [entry] })).toMatchObject({
      code: 'native-registration',
      files: [entry],
    })
    expect(resolveTemplateRegistrationFallback(new Map(), {
      entryIds: [entry],
      templateRegistrationSignatures: new Map([[entry, undefined]]),
    })).toMatchObject({ code: 'native-registration', files: [entry] })
  })

  it('compares frozen snapshots without following mutation of a later compiler generation', () => {
    const live = new Map(previous)
    const frozen = new Map(live)
    live.set(owner, 'a-later-save')
    expect(resolveTemplateRegistrationFallback(previous, { templateRegistrationSignatures: frozen })).toBeUndefined()
    expect(resolveTemplateRegistrationFallback(previous, { templateRegistrationSignatures: live })?.code).toBe('native-registration')
  })
})
