import type { Fetcher, PreviewManifest } from './contract.ts'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { archiveIntegrity, confirmRegistry, PACKAGE_NAME, packedFiles, previewVersion, REGISTRY, registryJson, validatePackage } from './contract.ts'

const manifest: PreviewManifest = {
  schemaVersion: 1,
  name: PACKAGE_NAME,
  version: '0.1.0-alpha.0',
  tag: 'alpha',
  registry: REGISTRY,
  sourceSha: 'a'.repeat(40),
  latestBefore: null,
  tarball: 'preview.tgz',
  integrity: archiveIntegrity(Buffer.from('archive')),
  files: [{ path: 'dist/index.mjs', size: 10 }],
  dist: [{ path: 'dist/index.mjs', size: 10, sha256: 'b'.repeat(64) }],
}
const provenance = { url: `${REGISTRY}/-/npm/v1/attestations/${encodeURIComponent(PACKAGE_NAME)}@${manifest.version}`, provenance: { predicateType: 'https://slsa.dev/provenance/v1' } }
const version = { name: PACKAGE_NAME, version: manifest.version, dist: { integrity: manifest.integrity, attestations: provenance } }
const metadata = { 'dist-tags': { alpha: manifest.version } }

describe('WXML preview boundaries', () => {
  it('accepts only the explicit alpha semver series', () => {
    expect(previewVersion('0.1.0-alpha.0')).toBe('0.1.0-alpha.0')
    expect(previewVersion('0.1.0-alpha.42')).toBe('0.1.0-alpha.42')
    for (const value of ['0.1.0', '0.1.0-alpha.01', '0.1.0-alpha.-1', '0.1.0-beta.1', '0.1.0-alpha.1+build', ' 0.1.0-alpha.1', '0.1.0-alpha.1\n']) {
      expect(() => previewVersion(value)).toThrow('PREVIEW_VERSION')
    }
  })

  it('rejects other packages, private publication and other registries', () => {
    const pkg = { name: PACKAGE_NAME, version: '0.0.0', files: ['README.md', 'dist'], main: './dist/index.mjs', types: './dist/index.d.mts', exports: { '.': { types: './dist/index.d.mts', import: './dist/index.mjs' }, './package.json': './package.json' }, publishConfig: { access: 'public', registry: REGISTRY } }
    expect(validatePackage(pkg)).toBe(pkg)
    for (const changed of [{ name: 'weapp-vite' }, { version: '1.0.0' }, { private: true }, { publishConfig: { access: 'public', registry: 'https://example.invalid' } }]) {
      expect(() => validatePackage({ ...pkg, ...changed })).toThrow()
    }
  })

  it('rejects leaked source, traversal and duplicate packed files', () => {
    for (const files of [
      [{ path: 'src/index.ts', size: 1 }],
      [{ path: 'dist/../secret', size: 1 }],
      [{ path: '/dist/index.mjs', size: 1 }],
      [{ path: 'dist/index.mjs', size: 1 }, { path: 'dist/index.mjs', size: 1 }],
    ]) {
      expect(() => packedFiles(files)).toThrow()
    }
  })

  it('preserves absence of latest and requires the exact alpha and archive', () => {
    expect(confirmRegistry(manifest, version, metadata)).toEqual({ url: provenance.url, predicateType: 'https://slsa.dev/provenance/v1' })
    expect(() => confirmRegistry(manifest, version, { 'dist-tags': { ...metadata['dist-tags'], latest: manifest.version } })).toThrow('latest changed')
    expect(() => confirmRegistry(manifest, version, { 'dist-tags': { alpha: '0.1.0-alpha.2' } })).toThrow('alpha')
    expect(() => confirmRegistry(manifest, { ...version, dist: { ...version.dist, integrity: 'different' } }, metadata)).toThrow('integrity')
  })

  it('keeps an existing latest unchanged and requires supported registry provenance', () => {
    const existing = { ...manifest, latestBefore: '0.0.0-oidc-init' }
    expect(confirmRegistry(existing, version, { 'dist-tags': { ...metadata['dist-tags'], latest: existing.latestBefore } }).url).toBe(provenance.url)
    expect(() => confirmRegistry(existing, version, metadata)).toThrow('latest changed')
    expect(() => confirmRegistry(manifest, { ...version, dist: { integrity: manifest.integrity } }, metadata)).toThrow()
    expect(() => confirmRegistry(manifest, { ...version, dist: { ...version.dist, attestations: { ...provenance, url: 'https://example.invalid/attestation' } } }, metadata)).toThrow('provenance URL')
  })

  it('treats only an explicitly allowed official 404 as absent', async () => {
    const missing = (async () => new Response('{}', { status: 404 })) as Fetcher
    expect(await registryJson(`${REGISTRY}/package`, missing, true)).toBeNull()
    await expect(registryJson(`${REGISTRY}/package`, missing)).rejects.toThrow('HTTP 404')
    for (const status of [401, 403, 429, 500]) {
      const failed = (async () => new Response('{}', { status })) as Fetcher
      await expect(registryJson(`${REGISTRY}/package`, failed, true)).rejects.toThrow(`HTTP ${status}`)
    }
    await expect(registryJson('https://example.invalid/package', missing, true)).rejects.toThrow()
  })
})
