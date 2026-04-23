import { describe, expect, it } from 'vitest'
import { DEFAULT_HMR_PROFILE_JSONL_RELATIVE_PATH, resolveHmrProfileJsonPath } from './hmrProfile'

describe('resolveHmrProfileJsonPath', () => {
  it('resolves default path when enabled', () => {
    expect(resolveHmrProfileJsonPath({
      cwd: '/project',
      option: true,
    })).toBe(`/project/${DEFAULT_HMR_PROFILE_JSONL_RELATIVE_PATH}`)
  })

  it('resolves custom relative path from cwd', () => {
    expect(resolveHmrProfileJsonPath({
      cwd: '/project',
      option: '.reports/hmr.jsonl',
    })).toBe('/project/.reports/hmr.jsonl')
  })

  it('returns undefined when disabled without fallback', () => {
    expect(resolveHmrProfileJsonPath({
      cwd: '/project',
      option: false,
    })).toBeUndefined()
  })

  it('falls back to default path when requested', () => {
    expect(resolveHmrProfileJsonPath({
      cwd: '/project',
      option: false,
      fallbackToDefault: true,
    })).toBe(`/project/${DEFAULT_HMR_PROFILE_JSONL_RELATIVE_PATH}`)
  })
})
