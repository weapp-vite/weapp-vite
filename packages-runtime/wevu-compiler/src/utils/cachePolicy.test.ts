import { describe, expect, it } from 'vitest'
import {
  DEV_PATH_EXISTS_TTL_MS,
  getPathExistsTtlMs,
  getReadFileCheckMtime,
  PROD_PATH_EXISTS_TTL_MS,
} from './cachePolicy'

describe('cachePolicy', () => {
  it('uses dev ttl only when isDev is explicitly true', () => {
    expect(getPathExistsTtlMs({ isDev: true })).toBe(DEV_PATH_EXISTS_TTL_MS)
    expect(getPathExistsTtlMs({ isDev: false })).toBe(PROD_PATH_EXISTS_TTL_MS)
    expect(getPathExistsTtlMs({})).toBe(PROD_PATH_EXISTS_TTL_MS)
    expect(getPathExistsTtlMs()).toBe(PROD_PATH_EXISTS_TTL_MS)
  })

  it('checks mtime only in dev mode', () => {
    expect(getReadFileCheckMtime({ isDev: true })).toBe(true)
    expect(getReadFileCheckMtime({ isDev: false })).toBe(false)
    expect(getReadFileCheckMtime({})).toBe(false)
    expect(getReadFileCheckMtime()).toBe(false)
  })
})
