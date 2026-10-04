import type { ConfigService } from '../runtime/config/types'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProfileOutputMatcher } from './profileOutput'

function config(cwd: string, profileJson?: boolean | string) {
  return { cwd, weappViteConfig: { hmr: { profileJson } } } as Pick<ConfigService, 'cwd' | 'weappViteConfig'>
}

describe('profile output ownership', () => {
  beforeEach(() => {
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('matches only the enabled output, preserving neighboring user files and directories', () => {
    const matches = createProfileOutputMatcher(config('/project', true))
    expect(matches('/project/.weapp-vite/hmr-profile.jsonl')).toBe(true)
    expect(matches('.weapp-vite/./hmr-profile.jsonl')).toBe(true)
    for (const file of [
      '/project/.weapp-vite',
      '/project/.weapp-vite/hmr-profile.jsonl.backup',
      '/project/.weapp-vite/hmr-profile.jsonl/index.ts',
      '/project/.weapp-vite/user-config.json',
      '/project/src/hmr-profile.jsonl',
      '/project-sibling/.weapp-vite/hmr-profile.jsonl',
    ]) {
      expect(matches(file)).toBe(false)
    }
  })

  it.each([undefined, false, ''])('does not own a same-named user file when output is %s', (option) => {
    const matches = createProfileOutputMatcher(config('/project', option))
    expect(matches('/project/.weapp-vite/hmr-profile.jsonl')).toBe(false)
    expect(createProfileOutputMatcher()('/project/.weapp-vite/hmr-profile.jsonl')).toBe(false)
  })

  it('tracks current config and writer environment precedence without retaining old exclusions', () => {
    const selected = config('/project', '.reports/hmr.jsonl')
    const matches = createProfileOutputMatcher(selected)
    expect(matches('/project/.reports/hmr.jsonl')).toBe(true)
    expect(matches('/project/.weapp-vite/hmr-profile.jsonl')).toBe(false)
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', ' .observations/runtime.jsonl ')
    expect(matches('/project/.reports/hmr.jsonl')).toBe(false)
    expect(matches('/project/.observations/runtime.jsonl')).toBe(true)
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '1')
    expect(matches('/project/.weapp-vite/hmr-profile.jsonl')).toBe(true)
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', undefined)
    selected.weappViteConfig.hmr!.profileJson = false
    expect(matches('/project/.reports/hmr.jsonl')).toBe(false)
  })

  it('normalizes Windows separators while preserving the host filesystem case policy', () => {
    const matches = createProfileOutputMatcher(config('C:/project', '.reports/hmr.jsonl'))
    expect(matches('C:\\project\\.reports\\hmr.jsonl')).toBe(true)
    expect(matches('C:/project/.reports/../.reports/hmr.jsonl')).toBe(true)
    expect(matches('C:/project/.reports/HMR.jsonl')).toBe(process.platform === 'win32')
    expect(matches('C:/project/.reports/hmr.jsonl.old')).toBe(false)
    expect(matches('C:/project-sibling/.reports/hmr.jsonl')).toBe(false)
  })
})
