import type { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const PACKAGE_NAME = '@weapp-vite/wxml'
export const REGISTRY = 'https://registry.npmjs.org'
export const PREVIEW_TAG = 'alpha'
export const PACKAGE_ENDPOINT = `${REGISTRY}/${encodeURIComponent(PACKAGE_NAME)}`
export type Fetcher = typeof fetch
export interface PackedFile { path: string, size: number, mode?: number }
export interface DistFile { path: string, size: number, sha256: string }
export interface PreviewManifest {
  schemaVersion: 1
  name: typeof PACKAGE_NAME
  version: string
  tag: typeof PREVIEW_TAG
  registry: typeof REGISTRY
  sourceSha: string
  latestBefore: string | null
  tarball: string
  integrity: string
  files: PackedFile[]
  dist: DistFile[]
}

export class RegistryPropagationPending extends Error {}

/** 预览版本限定为独立 alpha 序列，避免触及正式版本与默认标签。 */
export function previewVersion(value: unknown): string {
  assert.ok(typeof value === 'string' && value === value.trim() && value.length < 256 && /^0\.1\.0-alpha\.(?:0|[1-9]\d*)$/.test(value), 'PREVIEW_VERSION must be 0.1.0-alpha.N without leading zeroes')
  return value
}

export function sourceSha(value: unknown): string {
  assert.ok(typeof value === 'string' && value.length === 40 && /^[a-f\d]{40}$/.test(value), 'GITHUB_SHA must identify the guarded main commit')
  return value
}

export function record(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected JSON object')
  return value as Record<string, unknown>
}

/** 只允许当前公开 npmjs 包，预览不使用其他包或 workspace 发布入口。 */
export function validatePackage(value: unknown) {
  const pkg = record(value)
  const publish = record(pkg.publishConfig)
  assert.equal(pkg.name, PACKAGE_NAME, 'Preview may pack only @weapp-vite/wxml')
  assert.equal(pkg.version, '0.0.0', 'Source package must retain version 0.0.0')
  assert.notEqual(pkg.private, true, 'Preview package must be public')
  assert.equal(publish.access, 'public')
  assert.equal(publish.registry, REGISTRY)
  assert.deepEqual(pkg.files, ['README.md', 'dist'], 'Preview must preserve the package file boundary')
  assert.equal(pkg.main, './dist/index.mjs')
  assert.equal(pkg.types, './dist/index.d.mts')
  assert.deepEqual(pkg.exports, { '.': { types: './dist/index.d.mts', import: './dist/index.mjs' }, './package.json': './package.json' })
  return pkg
}

export function archiveIntegrity(bytes: Buffer) {
  return `sha512-${createHash('sha512').update(bytes).digest('base64')}`
}

function packagePath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('\\')
    && !value.startsWith('/') && !value.split('/').some(part => !part || part === '.' || part === '..')
    && !/[\r\n\0]/.test(value)
}

export function packedFiles(value: unknown): PackedFile[] {
  assert.ok(Array.isArray(value) && value.length > 0, 'npm pack must report its files')
  const seen = new Set<string>()
  return value.map((entry) => {
    const file = record(entry)
    assert.ok(packagePath(file.path) && !seen.has(file.path), 'Invalid or duplicate packed path')
    assert.ok(typeof file.size === 'number' && Number.isSafeInteger(file.size) && file.size >= 0)
    assert.ok(file.path.startsWith('dist/') || /^(?:package\.json|README\.md|LICEN[CS]E(?:\.md)?)$/.test(file.path), `Unexpected preview file: ${file.path}`)
    seen.add(file.path)
    return { path: file.path, size: file.size, ...(typeof file.mode === 'number' ? { mode: file.mode } : {}) }
  })
}

export function readPreviewManifest(value: unknown): PreviewManifest {
  const manifest = record(value)
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.name, PACKAGE_NAME)
  assert.equal(manifest.registry, REGISTRY)
  assert.equal(manifest.tag, PREVIEW_TAG)
  previewVersion(manifest.version)
  sourceSha(manifest.sourceSha)
  assert.ok(manifest.latestBefore === null || typeof manifest.latestBefore === 'string')
  assert.ok(typeof manifest.tarball === 'string' && !/[\r\n\0]/.test(manifest.tarball))
  assert.ok(typeof manifest.integrity === 'string' && manifest.integrity.length === 95 && /^sha512-[A-Za-z\d+/]{86}==$/.test(manifest.integrity))
  packedFiles(manifest.files)
  assert.ok(Array.isArray(manifest.dist) && manifest.dist.length > 0)
  for (const entry of manifest.dist) {
    const file = record(entry)
    assert.ok(packagePath(file.path) && file.path.startsWith('dist/'))
    assert.ok(typeof file.size === 'number' && Number.isSafeInteger(file.size) && file.size >= 0)
    assert.ok(typeof file.sha256 === 'string' && /^[a-f\d]{64}$/.test(file.sha256))
  }
  return manifest as unknown as PreviewManifest
}

/** 所有读取固定使用官方 registry，404 仅在显式预检时表示尚未发布。 */
export async function registryJson(url: string, fetcher: Fetcher, missingAllowed = false, signal?: AbortSignal) {
  assert.equal(new URL(url).origin, REGISTRY)
  const requestTimeout = AbortSignal.timeout(20_000)
  const response = await fetcher(url, { headers: { 'accept': 'application/json', 'cache-control': 'no-cache' }, redirect: 'error', signal: signal ? AbortSignal.any([requestTimeout, signal]) : requestTimeout })
  if (response.status === 404 && missingAllowed) {
    return null
  }
  assert.ok(response.ok, `npm registry request failed: HTTP ${response.status}`)
  return record(await response.json())
}

export function latestTag(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return null
  }
  const tags = record(metadata['dist-tags'])
  const latest = tags.latest
  assert.ok(latest === undefined || typeof latest === 'string', 'Invalid latest dist-tag')
  return latest ?? null
}

export function confirmRegistry(manifest: PreviewManifest, version: Record<string, unknown>, metadata: Record<string, unknown>) {
  assert.equal(version.name, PACKAGE_NAME)
  assert.equal(version.version, manifest.version)
  const dist = record(version.dist)
  assert.equal(dist.integrity, manifest.integrity, 'Published integrity differs from the packed archive')
  assert.equal(latestTag(metadata), manifest.latestBefore, 'latest changed during the alpha preview publish')
  if (record(metadata['dist-tags']).alpha !== manifest.version) {
    throw new RegistryPropagationPending('alpha must resolve to this exact preview')
  }
  if (dist.attestations === undefined) {
    throw new RegistryPropagationPending('Registry provenance metadata has not propagated')
  }
  const attestations = record(dist.attestations)
  const predicateType = record(attestations.provenance).predicateType
  assert.ok(predicateType === 'https://slsa.dev/provenance/v1' || predicateType === 'https://slsa.dev/provenance/v0.2', 'Registry did not record supported provenance metadata')
  assert.ok(typeof attestations.url === 'string' && new URL(attestations.url).origin === REGISTRY, 'Invalid registry provenance URL')
  return { url: attestations.url, predicateType }
}
