import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 独立消费者必须跨平台执行包管理器。
import { execa } from 'execa'
import { stringify } from 'yaml'
import { parsePnpmLockfile } from '../../../scripts/pnpmLockfile/index.mjs'
import { createConsumerTemporaryRoot, packConsumerTarballs, readConsumerTarballs, verifyConsumerTarballProvenance } from './consumerTarballs.mjs'
import { verifyDependencySemantics } from './verify-dependency-semantics.mjs'

const manager = process.argv[2] ?? 'pnpm'
assert(['pnpm', 'npm'].includes(manager), 'Usage: node verify-dependency-install.mjs [pnpm|npm]')
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const temporaryRoot = await createConsumerTemporaryRoot()
const root = path.join(temporaryRoot, 'consumer')
const env = { npm_config_legacy_peer_deps: 'false', npm_config_force: 'false', npm_config_ignore_scripts: 'false', npm_config_engine_strict: 'true' }
try {
  await mkdir(root)
  const candidates = process.env.WEAPP_VITE_CONSUMER_TARBALLS
    ? await readConsumerTarballs(path.resolve(process.env.WEAPP_VITE_CONSUMER_TARBALLS))
    : await packConsumerTarballs(repoRoot, temporaryRoot)
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'weapp-vite-host-dependency-compatibility', private: true, type: 'module', dependencies: { ...candidates, typescript: '6.0.3' } }, null, 2))
  if (manager === 'pnpm') {
    // 只映射未发布的框架候选闭包；不覆盖注册表依赖版本、peer 声明或校验。
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), stringify({ overrides: candidates, allowBuilds: { '@swc/core': true, 'esbuild': true } }))
  }
  await execa(manager, manager === 'pnpm' ? ['install', '--strict-peer-dependencies', '--config.engine-strict=true', '--config.ignore-scripts=false'] : ['install', '--strict-peer-deps'], { cwd: root, env, stdio: 'inherit' })
  let packages
  if (manager === 'npm') {
    await verifyConsumerTarballProvenance(root, candidates)
    packages = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8')).packages
  }
  else {
    packages = parsePnpmLockfile(await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8')).packages
    for (const [name, archive] of Object.entries(candidates)) {
      const matches = Object.entries(packages).filter(([key]) => key.startsWith(`${name}@`))
      assert(matches.length, `Missing installed candidate: ${name}`)
      for (const [, entry] of matches) {
        assert.equal(path.resolve(root, entry.resolution.tarball.replace(/^file:/, '')), path.resolve(archive.slice(5)), `Candidate must resolve to its tarball: ${name}`)
      }
    }
  }
  assert(!Object.keys(packages).some(key => manager === 'npm' ? key.endsWith('/tsconfck') : key.startsWith('tsconfck@')), 'TS5-only tsconfck must not remain in the framework closure')
  const watched = ['@csstools/css-parser-algorithms', '@csstools/css-color-parser', '@csstools/css-calc', 'vite-tsconfig-paths', 'get-tsconfig', 'typescript']
  const versions = Object.entries(packages).flatMap(([key, entry]) => {
    const name = watched.find(name => manager === 'npm' ? key.endsWith(`/node_modules/${name}`) || key === `node_modules/${name}` : key.startsWith(`${name}@`))
    return name ? [{ name, version: entry.version ?? key.slice(name.length + 1), peers: entry.peerDependencies ?? {} }] : []
  })
  const semantics = await verifyDependencySemantics(root)
  const evidence = { schemaVersion: 1, manager, node: process.version, strictPeers: true, versions, semantics }
  const destination = process.env.WEAPP_VITE_DEPENDENCY_EVIDENCE
  if (destination) {
    await mkdir(path.dirname(path.resolve(destination)), { recursive: true })
    await writeFile(destination, `${JSON.stringify(evidence, null, 2)}\n`)
  }
  console.log(JSON.stringify(evidence, null, 2))
}
finally {
  if (process.env.WEAPP_VITE_CONSUMER_KEEP === '1') {
    console.log(`Retained dependency consumer: ${root}`)
  }
  else {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
