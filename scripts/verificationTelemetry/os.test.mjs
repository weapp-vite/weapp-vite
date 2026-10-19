import { expect, it } from 'vitest'
import { runtimeOs, verificationResource } from './os.mjs'

it.each([['Linux', 'linux'], ['Windows', 'win32'], ['macOS', 'darwin']])('maps only the official %s name and preserves its actual value', (actual, expected) => {
  expect(runtimeOs(actual)).toBe(expected)
  expect(runtimeOs(expected)).toBe(expected)
  const resource = verificationResource({ os: actual, arch: 'x64', toolchain: { nodeVersion: 'v24.18.0', actualPackageManager: 'pnpm@12.11.2' } }, { os: expected, arch: 'x64', nodeMajor: 24 })
  expect(resource.os).toBe(actual)
})

it.each(['MacOS', 'LINUX', '', null, 'freebsd'])('rejects unsupported operating-system value %s', value => expect(() => runtimeOs(value)).toThrow(/operating system/))

it.each([
  { os: 'win32', arch: 'x64', nodeMajor: 24 },
  { os: 'linux', arch: 'arm64', nodeMajor: 24 },
  { os: 'linux', arch: 'x64', nodeMajor: 22 },
  { os: 'linux', nodeMajor: 24 },
])('rejects real platform, architecture or Node mismatch %j', profile => expect(() => verificationResource({ os: 'Linux', arch: 'x64', toolchain: { nodeVersion: 'v24.18.0', actualPackageManager: 'pnpm@12.11.2' } }, profile)).toThrow(/identity/))
