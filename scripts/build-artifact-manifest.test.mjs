import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it } from 'vitest'
import { createBuildArtifactManifest, verifyBuildArtifactManifest } from './buildArtifact/index.mjs'

const directories = []
const env = { BUILD_ARTIFACT_EXPECTED_COMMIT: 'a'.repeat(40), BUILD_ARTIFACT_PACKAGE_MANAGER: 'pnpm@12.11.2' }

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'build-artifact-'))
  directories.push(root)
  await mkdir(path.join(root, 'packages/example/dist'), { recursive: true })
  await writeFile(path.join(root, 'packages/example/dist/index.js'), 'export const value = 1\n')
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@12.11.2' }))
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  return root
}

it('binds uploaded outputs to revision, toolchain, lockfile and package scope', async () => {
  const root = await fixture()
  const manifest = createBuildArtifactManifest(root, env)
  expect(manifest.scope).toEqual(['packages/example'])
  expect(manifest.files).toEqual(['packages/example/dist/index.js'])
  expect(verifyBuildArtifactManifest(root, manifest, env)).toBe(manifest)
  expect(() => verifyBuildArtifactManifest(root, manifest, { ...env, BUILD_ARTIFACT_EXPECTED_SCOPE: 'packages/absent' })).toThrow(/required packages/)
  expect(() => verifyBuildArtifactManifest(root, manifest, { ...env, BUILD_ARTIFACT_EXPECTED_COMMIT: 'b'.repeat(40) })).toThrow(/commit/)
  expect(() => verifyBuildArtifactManifest(root, manifest, { ...env, BUILD_ARTIFACT_EXPECTED_NODE_MAJOR: '0' })).toThrow(/nodeMajor/)
  expect(() => verifyBuildArtifactManifest(root, manifest, { ...env, BUILD_ARTIFACT_EXPECTED_ARCH: 'other' })).toThrow(/arch/)
  expect(() => verifyBuildArtifactManifest(root, manifest, { ...env, BUILD_ARTIFACT_PACKAGE_MANAGER: 'pnpm@12.14.0' })).toThrow(/toolchain/)
  expect(() => verifyBuildArtifactManifest(root, { ...manifest, toolchain: { ...manifest.toolchain, nodeVersion: 'invalid' } }, env)).toThrow(/toolchain/)
  expect(() => verifyBuildArtifactManifest(root, { ...manifest, toolchain: { ...manifest.toolchain, nodeVersion: 'v0.1.0' } }, env)).toThrow(/toolchain/)
})

it('rejects changed bytes even when all output filenames still exist', async () => {
  const root = await fixture()
  const manifest = createBuildArtifactManifest(root, env)
  await writeFile(path.join(root, manifest.files[0]), 'export const value = 2\n')
  expect(() => verifyBuildArtifactManifest(root, manifest, env)).toThrow(/checksum/)
})

it('rejects changed lockfiles and package managers independently', async () => {
  const root = await fixture()
  const manifest = createBuildArtifactManifest(root, env)
  const lock = await readFile(path.join(root, 'pnpm-lock.yaml'))
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 10\n')
  expect(() => verifyBuildArtifactManifest(root, manifest, env)).toThrow(/lockfileHash/)
  await writeFile(path.join(root, 'pnpm-lock.yaml'), lock)
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@99.0.0' }))
  expect(() => verifyBuildArtifactManifest(root, manifest, env)).toThrow(/toolchain/)
})

it('rejects duplicates, incomplete digests and scope drift', async () => {
  const root = await fixture()
  const manifest = createBuildArtifactManifest(root, env)
  expect(() => verifyBuildArtifactManifest(root, { ...manifest, files: [...manifest.files, ...manifest.files] }, env)).toThrow(/duplicated/)
  expect(() => verifyBuildArtifactManifest(root, { ...manifest, checksums: {} }, env)).toThrow(/inventory/)
  expect(() => verifyBuildArtifactManifest(root, { ...manifest, scope: [] }, env)).toThrow(/scope/)
  expect(() => verifyBuildArtifactManifest(root, { ...manifest, schemaVersion: 1 }, env)).toThrow(/schema/)
})

it('only collects package-level dist and bin outputs', async () => {
  const root = await fixture()
  await mkdir(path.join(root, 'packages/example/test/nested/dist'), { recursive: true })
  await writeFile(path.join(root, 'packages/example/test/nested/dist/noise.js'), 'noise')
  expect(createBuildArtifactManifest(root, env).files).toEqual(['packages/example/dist/index.js'])
})

it('rejects traversal outside this workspace', async () => {
  const root = await fixture()
  const manifest = createBuildArtifactManifest(root, env)
  const unsafe = 'packages/example/dist/../../../package.json'
  expect(() => verifyBuildArtifactManifest(root, { ...manifest, files: [unsafe], checksums: { [unsafe]: '0'.repeat(64) } }, env)).toThrow(/Invalid/)
})

it('rejects symlinks to outputs outside this workspace', async (context) => {
  const root = await fixture()
  const other = await fixture()
  try {
    await symlink(path.join(other, 'packages/example/dist/index.js'), path.join(root, 'packages/example/dist/outside.js'))
  }
  catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') {
      context.skip('Windows runner does not grant file symlink creation')
      return
    }
    throw error
  }
  expect(() => createBuildArtifactManifest(root, env)).toThrow(/escapes/)
})
