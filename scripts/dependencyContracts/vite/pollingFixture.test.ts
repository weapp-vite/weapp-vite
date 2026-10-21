import fs from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { assertPollingFixtureRoot, resolvePollingFixtureRoot } from './pollingFixture.mjs'

afterEach(() => vi.restoreAllMocks())

it('uses the native canonical root when JavaScript realpath retains a Windows short directory alias', () => {
  const alias = String.raw`C:\Users\FIXTUR~1\AppData\Local\Temp\polling-fixture`
  const canonical = String.raw`C:\Users\fixture-user\AppData\Local\Temp\polling-fixture`
  const nativeRealpath = vi.spyOn(fs.realpathSync, 'native').mockReturnValue(canonical)

  expect(resolvePollingFixtureRoot(alias)).toBe(canonical)
  expect(nativeRealpath).toHaveBeenCalledExactlyOnceWith(alias)
  expect(() => assertPollingFixtureRoot(canonical.replaceAll('\\', '/'), canonical, 'win32')).not.toThrow()
  expect(() => assertPollingFixtureRoot(alias, canonical, 'win32')).toThrow('same canonical fixture root')
})

it('preserves native resolution failures instead of using an unverified fixture root', () => {
  const failure = new Error('native realpath unavailable')
  vi.spyOn(fs.realpathSync, 'native').mockImplementation(() => {
    throw failure
  })

  expect(() => resolvePollingFixtureRoot('polling-fixture')).toThrow(failure)
})

it('preserves POSIX canonical paths and rejects different fixtures or path casing', () => {
  const canonical = '/canonical-fixtures/polling-owner'
  vi.spyOn(fs.realpathSync, 'native').mockReturnValue(canonical)

  expect(resolvePollingFixtureRoot('/fixture-alias/polling-owner')).toBe(canonical)
  expect(() => assertPollingFixtureRoot(canonical, canonical, 'linux')).not.toThrow()
  expect(() => assertPollingFixtureRoot('/canonical-fixtures/other-owner', canonical, 'linux')).toThrow('same canonical fixture root')
  expect(() => assertPollingFixtureRoot('/canonical-fixtures/Polling-owner', canonical, 'darwin')).toThrow('same canonical fixture root')
})
