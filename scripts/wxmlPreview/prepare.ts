import type { DistFile, Fetcher, PreviewManifest } from './contract.ts'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- npm 启动需要跨平台命令解析。
import { execa } from 'execa'
import { archiveIntegrity, latestTag, PACKAGE_ENDPOINT, PACKAGE_NAME, packedFiles, PREVIEW_TAG, previewVersion, REGISTRY, registryJson, sourceSha, validatePackage } from './contract.ts'

interface PrepareOptions { root: string, env?: NodeJS.ProcessEnv, fetcher?: Fetcher }

async function distInventory(directory: string, prefix = 'dist'): Promise<DistFile[]> {
  const files: DistFile[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.posix.join(prefix, entry.name)
    assert.ok(!entry.isSymbolicLink(), 'Preview dist must contain regular tsdown outputs')
    if (entry.isDirectory()) {
      files.push(...await distInventory(path.join(directory, entry.name), filename))
    }
    else {
      assert.ok(entry.isFile(), 'Preview dist contains an unsupported entry')
      const bytes = await readFile(path.join(directory, entry.name))
      files.push({ path: filename, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path, 'en'))
}

/** 仅打包已构建 dist；临时版本始终还原，不消费 changeset 或发布账本。 */
export async function preparePreview({ root, env = process.env, fetcher = fetch }: PrepareOptions) {
  const version = previewVersion(env.PREVIEW_VERSION)
  const sha = sourceSha(env.GITHUB_SHA)
  assert.ok(env.RUNNER_TEMP && path.isAbsolute(env.RUNNER_TEMP), 'RUNNER_TEMP must be an absolute CI temporary directory')
  const output = path.join(env.RUNNER_TEMP, 'wxml-preview')
  assert.ok(!/[\r\n\0]/.test(output), 'Invalid runner temporary path')
  const directory = path.join(root, 'packages/wxml')
  const packageFile = path.join(directory, 'package.json')
  const original = await readFile(packageFile)
  const pkg = validatePackage(JSON.parse(original.toString()) as unknown)
  const dist = await distInventory(path.join(directory, 'dist'))
  assert.ok(dist.some(file => file.path === 'dist/index.mjs' && file.size > 0), 'Build tsdown dist/index.mjs before preparing preview')
  assert.ok(dist.some(file => file.path === 'dist/index.d.mts' && file.size > 0), 'Build tsdown types before preparing preview')
  const existing = await registryJson(`${PACKAGE_ENDPOINT}/${version}`, fetcher, true)
  assert.equal(existing, null, 'Preview version already exists; choose a new alpha version')
  const latestBefore = latestTag(await registryJson(PACKAGE_ENDPOINT, fetcher, true))
  await mkdir(output)
  let manifest: PreviewManifest
  try {
    await writeFile(packageFile, `${JSON.stringify({ ...pkg, version }, null, 2)}\n`)
    const result = await execa('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output], { cwd: directory })
    const packed: unknown = JSON.parse(result.stdout)
    assert.ok(Array.isArray(packed) && packed.length === 1, 'npm pack must produce exactly one archive')
    const info = packed[0] as Record<string, unknown>
    assert.equal(info.name, PACKAGE_NAME)
    assert.equal(info.version, version)
    assert.equal(typeof info.filename, 'string')
    assert.equal(info.filename, `weapp-vite-wxml-${version}.tgz`)
    const tarball = path.join(output, info.filename as string)
    const bytes = await readFile(tarball)
    assert.equal(info.size, bytes.length, 'npm pack size does not match archive bytes')
    const integrity = archiveIntegrity(bytes)
    assert.equal(info.integrity, integrity, 'npm pack integrity does not match archive bytes')
    const files = packedFiles(info.files)
    assert.ok(files.some(file => file.path === 'package.json'))
    assert.ok(files.some(file => file.path === 'README.md'))
    const packedDist = files.filter(file => file.path.startsWith('dist/')).map(({ path, size }) => ({ path, size })).sort((left, right) => left.path.localeCompare(right.path, 'en'))
    assert.deepEqual(packedDist, dist.map(({ path, size }) => ({ path, size })), 'Archive must contain the complete existing tsdown dist')
    assert.deepEqual(await distInventory(path.join(directory, 'dist')), dist, 'tsdown outputs changed while packing')
    manifest = { schemaVersion: 1, name: PACKAGE_NAME, version, tag: PREVIEW_TAG, registry: REGISTRY, sourceSha: sha, latestBefore, tarball, integrity, files, dist }
  }
  finally {
    await writeFile(packageFile, original)
  }
  const manifestPath = path.join(output, 'manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  if (env.GITHUB_OUTPUT) {
    await appendFile(env.GITHUB_OUTPUT, `tarball=${manifest.tarball}\nmanifest=${manifestPath}\n`)
  }
  return { tarball: manifest.tarball, manifest: manifestPath, metadata: manifest }
}
