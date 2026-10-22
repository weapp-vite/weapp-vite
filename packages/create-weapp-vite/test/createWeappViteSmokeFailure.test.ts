import { describe, expect, it } from 'vitest'
import { classifyFailure } from '../../../scripts/createWeappViteSmoke/registry.mjs'

describe('scaffold smoke network failure classification', () => {
  const yarnMissingVersion = 'error Couldn\'t find any versions for "@rolldown/binding-freebsd-x64" that matches "1.2.15"'

  it.each(['registry', 'create', 'install'])('recognizes Yarn mirror metadata gaps during %s', (stage) => {
    expect(classifyFailure(new Error(yarnMissingVersion), { registryProfile: 'npmmirror', stage })).toBe('registry-unavailable')
  })

  it('retains product classification for a missing version on the official registry', () => {
    expect(classifyFailure(new Error(yarnMissingVersion), { registryProfile: 'npmjs', stage: 'install' })).toBe('product')
  })

  it.each(['prepare', 'build', 'dev'])('does not attribute %s failures to earlier mirror metadata output', (stage) => {
    expect(classifyFailure(new Error(yarnMissingVersion), { registryProfile: 'npmmirror', stage })).toBe('product')
  })

  it('prioritizes a terminal product error over a mirror metadata gap', () => {
    const message = `${yarnMissingVersion}\nError [ERR_MODULE_NOT_FOUND]: Cannot find package vite`
    expect(classifyFailure(new Error(message), { registryProfile: 'npmmirror', stage: 'install' })).toBe('product')
  })

  it.each([
    '[WARN] GET https://registry.npmjs.org/vite error (Failed to fetch https://registry.npmjs.org/vite)',
    'error sending request: operation timed out',
  ])('recognizes pnpm native network errors: %s', (message) => {
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage: 'install' })).toBe('network')
  })

  it.each(['create', 'install'])('identifies a %s timeout while packages are still downloading', (stage) => {
    const message = '[npmjs] Timed out after 600000ms\nDownloading @esbuild/darwin-arm64: 1.2 MB/10 MB'
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage })).toBe('network')
  })

  it.each(['create', 'install'])('preserves pnpm binary bootstrap network evidence during %s', (stage) => {
    const message = 'Downloading the pnpm 12.15.0 binary for linux-x64...\r\nCould not download the pnpm 12.15.0 binary: Could not reach https://registry.npmjs.org/@pnpm/exe.linux-x64/12.15.0: timed out after 30s'
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage })).toBe('network')
  })

  it('keeps terminal product failures above an earlier pnpm binary bootstrap timeout', () => {
    const message = 'Could not download the pnpm 12.15.0 binary: Could not reach https://registry.npmjs.org/@pnpm/exe.win-x64/12.15.0: timed out after 30s\nError [ERR_MODULE_NOT_FOUND]: Cannot find package vite'
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage: 'create' })).toBe('product')
  })

  it.each(['prepare', 'build', 'dev'])('does not infer a %s network failure from an earlier pnpm bootstrap timeout', (stage) => {
    const message = 'Could not download the pnpm 12.15.0 binary: Could not reach https://registry.npmjs.org/@pnpm/exe.linux-x64/12.15.0: timed out after 30s\nTimed out waiting for outputs'
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage })).toBe('product')
  })

  it.each([
    'node_modules/esbuild postinstall$ node install.js',
    '> app@1.0.0 prepare\n> wv prepare',
    'node_modules/esbuild install$ node install.js',
    '> app@1.0.0 install\n> node install.js',
    '> app@1.0.0 build\n> wv build',
    'app build: vite building...',
    '> wv build',
  ])('retains product classification after lifecycle execution: %s', (lifecycleOutput) => {
    const message = `Timed out after 600000ms\nDownloading @esbuild/darwin-arm64: 10 MB/10 MB\n${lifecycleOutput}`
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage: 'install' })).toBe('product')
  })

  it.each(['dev', 'prepare', 'build'])('does not infer a network failure from stale download output during %s', (stage) => {
    const message = 'Timed out after 600000ms\nDownloading vite: 1 MB/2 MB'
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage })).toBe('product')
  })

  it('keeps an unexplained install timeout classified as a product failure', () => {
    expect(classifyFailure(new Error('Timed out after 600000ms'), { registryProfile: 'npmjs', stage: 'install' })).toBe('product')
  })

  it.each([
    'ERR_PNPM_IGNORED_BUILDS Ignored build scripts: esbuild',
    'ERR_PNPM_UNSUPPORTED_ENGINE Unsupported environment',
    'Error [ERR_MODULE_NOT_FOUND]: Cannot find package vite',
    '> app@1.0.0 postinstall\n> wv prepare\nELIFECYCLE Command failed with exit code 1',
    '> app@1.0.0 postinstall\n> wv prepare\nTimed out after 600000ms',
  ])('prioritizes a terminal product failure over earlier network warnings: %s', (terminalError) => {
    const message = `[WARN] GET https://registry.npmjs.org/vite error (Failed to fetch: operation timed out)\n${terminalError}`
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage: 'install' })).toBe('product')
  })

  it.each([
    'postinstall: Error: getaddrinfo ENOTFOUND registry.npmjs.org',
    'postinstall: Failed to fetch https://registry.npmjs.org/esbuild',
    'error sending request: operation timed out',
  ])('preserves a fatal network error wrapped by ELIFECYCLE: %s', (networkError) => {
    const message = `> app@1.0.0 postinstall\n> node download-binary.js\n${networkError}\nELIFECYCLE Command failed with exit code 1`
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage: 'install' })).toBe('network')
  })

  it('keeps a dev timeout classified as product when only an earlier network retry warned', () => {
    const message = 'WARN request failed with ECONNRESET, retrying\nTimed out waiting for dev outputs'
    expect(classifyFailure(new Error(message), { registryProfile: 'npmjs', stage: 'dev' })).toBe('product')
  })
})
