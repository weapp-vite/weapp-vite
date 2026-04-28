import { describe, expect, it } from 'vitest'
import {
  createHmrProfileEventId,
  DEFAULT_HMR_PROFILE_JSONL_RELATIVE_PATH,
  HMR_PROFILE_JSON_ENV,
  resolveHmrProfileJsonEnvOption,
  resolveHmrProfileJsonPath,
} from './hmrProfile'

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

describe('resolveHmrProfileJsonEnvOption', () => {
  it('enables default profile output from env flag', () => {
    expect(resolveHmrProfileJsonEnvOption({
      [HMR_PROFILE_JSON_ENV]: '1',
    })).toBe(true)
    expect(resolveHmrProfileJsonEnvOption({
      [HMR_PROFILE_JSON_ENV]: 'true',
    })).toBe(true)
  })

  it('resolves custom profile output path from env', () => {
    expect(resolveHmrProfileJsonEnvOption({
      [HMR_PROFILE_JSON_ENV]: '.tmp/hmr.jsonl',
    })).toBe('.tmp/hmr.jsonl')
  })

  it('ignores disabled env values', () => {
    expect(resolveHmrProfileJsonEnvOption({
      [HMR_PROFILE_JSON_ENV]: '0',
    })).toBeUndefined()
  })
})

describe('createHmrProfileEventId', () => {
  it('creates unique ids for profile event correlation', () => {
    expect(createHmrProfileEventId()).not.toBe(createHmrProfileEventId())
  })
})
