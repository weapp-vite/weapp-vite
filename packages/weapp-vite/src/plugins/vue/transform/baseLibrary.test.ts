import { describe, expect, it } from 'vitest'
import { resolveBaseLibraryHintState, resolveProjectBaseLibraryVersion } from './baseLibrary'

function createConfigService(libVersion: unknown) {
  return { projectConfig: { libVersion } } as any
}

describe('resolveProjectBaseLibraryVersion', () => {
  it.each(['3.17.2', ' 2.25.2 ', 'v3.17.2', 'latest', 'trial'])('passes the configured libVersion %j through unchanged', (libVersion) => {
    expect(resolveProjectBaseLibraryVersion(createConfigService(libVersion))).toBe(libVersion)
  })

  it.each([undefined, '', 3])('ignores the missing or non-string libVersion %j', (libVersion) => {
    expect(resolveProjectBaseLibraryVersion(createConfigService(libVersion))).toBeUndefined()
  })
})

describe('resolveBaseLibraryHintState', () => {
  it('shares one hint state per config service', () => {
    const configService = createConfigService('2.25.2')
    const state = resolveBaseLibraryHintState(configService)
    expect(resolveBaseLibraryHintState(configService)).toBe(state)
    expect(state.reported.size).toBe(0)
  })

  it('keeps hint states independent across config services', () => {
    const first = resolveBaseLibraryHintState(createConfigService('2.25.2'))
    const second = resolveBaseLibraryHintState(createConfigService('2.25.2'))
    first.reported.add('root-portal')
    expect(second).not.toBe(first)
    expect(second.reported.size).toBe(0)
  })
})
