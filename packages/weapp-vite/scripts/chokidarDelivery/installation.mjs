import assert from 'node:assert/strict'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- npm 消费安装必须正确解析各平台启动器。
import { execa } from 'execa'
import { inspectConsumerInstallation, verifyConsumerExports } from '../consumerEvidence.mjs'
import { verifyConsumerTarballProvenance } from '../consumerTarballs.mjs'
import { hash, readArchive, verifyInstalledArchive } from './artifacts.mjs'
import { ordinaryEnvironment } from './supervisor.mjs'

/** 依赖边来自真实归档，仓库只提供 workspace 名称集合；漏包必须在 npm 回退到注册表前失败。 */
async function verifyWorkspaceTarballClosure(repositoryRoot, candidates) {
  assert(path.isAbsolute(repositoryRoot), 'The maintenance repository is required for workspace package identity')
  const listing = await execa('pnpm', ['--recursive', 'list', '--depth', '-1', '--json'], { cwd: repositoryRoot, env: ordinaryEnvironment() })
  const workspaceNames = new Set(JSON.parse(listing.stdout).map(project => project.name))
  const pending = ['weapp-vite']
  const verified = new Map()
  while (pending.length) {
    const name = pending.pop()
    if (verified.has(name)) {
      continue
    }
    assert(workspaceNames.has(name), `Unknown workspace package identity: ${name}`)
    assert(candidates[name]?.startsWith('file:'), `Missing workspace runtime tarball: ${name}`)
    const archive = readArchive(await readFile(candidates[name].slice('file:'.length)))
    const manifest = JSON.parse(archive.get('package/package.json').toString())
    assert.equal(manifest.name, name, `Tarball package identity mismatch: ${name}`)
    const dependencies = new Set()
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const dependency of Object.keys(manifest[section] ?? {})) {
        if (workspaceNames.has(dependency)) {
          assert(candidates[dependency], `Missing workspace runtime tarball: ${name} -> ${dependency}`)
          dependencies.add(dependency)
          pending.push(dependency)
        }
      }
    }
    verified.set(name, { name, version: manifest.version, workspaceDependencies: [...dependencies].sort() })
  }
  return { source: 'actual-archive-dependency-edges-and-repository-workspace-name-inventory', packages: [...verified.values()].sort((left, right) => left.name.localeCompare(right.name)) }
}

/** 使用普通 npm 严格 peer 安装完整候选闭包，不使用 patchedDependencies 或 workspace 链接。 */
export async function installConsumer(consumerRoot, candidates, baseline, repositoryRoot) {
  const workspaceClosure = await verifyWorkspaceTarballClosure(repositoryRoot, candidates)
  await mkdir(consumerRoot)
  const archive = candidates['weapp-vite'].slice('file:'.length)
  const manifest = JSON.parse(readArchive(await readFile(archive)).get('package/package.json').toString())
  assert.equal(manifest.name, 'weapp-vite')
  assert.equal(typeof manifest.dependencies?.vite, 'string', 'Packed compiler must declare Vite')
  const dependencies = { ...candidates, 'vite': manifest.dependencies.vite, 'typescript': '6.0.3', '@types/node': '^24.0.0' }
  if (baseline) {
    // 原始 tarball 不作改写，固定其满足公开依赖范围的未补丁注册表版本。
    dependencies.chokidar = '5.0.0'
  }
  await writeFile(path.join(consumerRoot, 'package.json'), `${JSON.stringify({ name: 'weapp-vite-chokidar-delivery-consumer', private: true, type: 'module', dependencies }, null, 2)}\n`)
  const env = { ...ordinaryEnvironment(), npm_config_legacy_peer_deps: 'false', npm_config_force: 'false', npm_config_ignore_scripts: 'false', npm_config_engine_strict: 'true' }
  const npmArguments = ['install', '--strict-peer-deps', '--legacy-peer-deps=false', '--force=false', '--ignore-scripts=false', '--engine-strict=true']
  const installation = await execa('npm', npmArguments, { cwd: consumerRoot, env, timeout: 600_000 })
  const provenance = await verifyConsumerTarballProvenance(consumerRoot, candidates)
  const installedFiles = await verifyInstalledArchive(path.join(consumerRoot, 'node_modules/weapp-vite'), archive)
  const exports = await verifyConsumerExports(consumerRoot, candidates)
  const tree = await inspectConsumerInstallation(consumerRoot)
  const installedManifest = JSON.parse(await readFile(path.join(consumerRoot, 'package.json'), 'utf8'))
  assert.equal(installedManifest.pnpm, undefined)
  assert.equal(installedManifest.overrides, undefined)
  let originalChokidar
  if (baseline) {
    const require = createRequire(path.join(consumerRoot, 'node_modules/weapp-vite/package.json'))
    const entry = require.resolve('chokidar')
    const upstream = JSON.parse(await readFile(path.join(path.dirname(entry), 'package.json'), 'utf8'))
    assert.equal(upstream.name, 'chokidar')
    assert.equal(upstream.version, '5.0.0', 'Baseline runtime must resolve the original registry Chokidar version')
    originalChokidar = { version: upstream.version, entry: path.relative(consumerRoot, entry).replaceAll('\\', '/') }
  }
  await cp(new URL('./probe/', import.meta.url), path.join(consumerRoot, 'probe'), { recursive: true })
  await mkdir(path.join(consumerRoot, 'projects'))
  return { archive: { version: manifest.version, sha256: hash(await readFile(archive)) }, workspaceClosure, npmArguments, provenance, installedFiles, exports, tree, originalChokidar, stdout: installation.stdout, stderr: installation.stderr }
}
