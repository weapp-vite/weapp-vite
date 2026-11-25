import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readCiToolchain, validateCiToolchain } from '../.github/scripts/ci-toolchain.mjs'

describe('CI toolchain policy', () => {
  it('keeps the shared runner and runtime policy valid', () => {
    const policy = readCiToolchain()
    expect(policy.runners).toEqual({
      ubuntu: 'ubuntu-latest',
      windows: 'windows-latest',
      macos: 'macos-15',
    })
    expect(policy.nativeAddon.targets).toEqual([
      { id: 'darwin-arm64', runner: 'macos-15' },
      { id: 'darwin-x64', runner: 'macos-15-intel' },
      { id: 'linux-arm64-gnu', runner: 'ubuntu-24.04-arm' },
      { id: 'linux-x64-gnu', runner: 'ubuntu-latest' },
      { id: 'win32-arm64-msvc', runner: 'windows-11-arm' },
      { id: 'win32-x64-msvc', runner: 'windows-latest' },
    ])
    expect(policy.node.supportMajors).toEqual([22, 24, 26])
    expect(policy.bun.matrix).toEqual(['1.4.2', 'latest'])
    expect(policy.parallel).toEqual({ default: 4, macos: 2 })
  })

  it('rejects a floating macOS label', () => {
    const policy = structuredClone(readCiToolchain())
    policy.runners.macos = 'macos-latest'
    expect(() => validateCiToolchain(policy)).toThrow('pinned runner label')
  })

  it('rejects incomplete native target runner coverage', () => {
    const policy = structuredClone(readCiToolchain())
    policy.nativeAddon.targets.pop()
    expect(() => validateCiToolchain(policy)).toThrow('cover every supported target')
  })

  it('keeps the policy source in the repository', () => {
    expect(JSON.parse(readFileSync(new URL('../.github/ci-toolchain.json', import.meta.url), 'utf8')).version).toBe(1)
  })
})
