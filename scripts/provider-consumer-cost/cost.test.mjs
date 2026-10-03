import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterEach, expect, it } from 'vitest'
import { consumerFixture, kinds } from './fixtures.mjs'
import { findDependencyPaths, inspectDependencyGraph, inspectInstallation } from './graph.mjs'
import { archiveFingerprint, assertCandidateIntegrity, assertConsumerInputs, snapshotConsumerInputs } from './identity.mjs'
import { buildConsumerSummary } from './report.mjs'

const execute = promisify(execFile)
const roots = []
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'provider-cost-test-'))
  roots.push(root)
  await packageAt(root, { name: 'consumer', dependencies: { 'weapp-vite': '1' } })
  return root
}
async function packageAt(root, manifest) {
  await mkdir(root, { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify(manifest))
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('keeps the native consumer minimal and declares only the selected feature', () => {
  const manifests = Object.fromEntries(kinds.map(kind => [kind, JSON.parse(consumerFixture(kind)['package.json'])]))
  expect(manifests.native.dependencies).toEqual({ 'weapp-vite': '7.4.0' })
  expect(manifests.wevu.dependencies).toEqual({ 'weapp-vite': '7.4.0', 'wevu': '7.4.0' })
  expect(manifests.tailwind.dependencies).toEqual({ 'weapp-vite': '7.4.0', 'tailwindcss': '4.3.3' })
  expect(consumerFixture('web')['weapp-vite.config.mjs']).toContain('"platform":"web"')
})

it('rejects a same-version repacked archive against the initially frozen identity', () => {
  const frozen = { version: '1.0.0', ...archiveFingerprint(Buffer.from('original candidate')) }
  const replacement = archiveFingerprint(Buffer.from('repacked candidate'))
  const lock = integrity => ({ packages: { 'weapp-vite@file:candidate.tgz': { resolution: { integrity } } } })
  expect(() => assertCandidateIntegrity('weapp-vite', '1.0.0', frozen, lock(frozen.integrity))).not.toThrow()
  expect(() => assertCandidateIntegrity('weapp-vite', '1.0.0', frozen, lock(replacement.integrity))).toThrow('archive integrity mismatch')
  expect(() => assertCandidateIntegrity('weapp-vite', '2.0.0', frozen, lock(frozen.integrity))).toThrow('version mismatch')
})

it.each(['package.json', 'pnpm-workspace.yaml'])('rejects changed %s even while the lock is unchanged', async (contract) => {
  const root = await fixture()
  const files = {
    'package.json': JSON.stringify({ dependencies: { 'weapp-vite': '1.0.0' } }),
    'pnpm-workspace.yaml': 'overrides:\n  weapp-vite: file:candidate.tgz\n',
    'entry.mjs': 'import "weapp-vite"\n',
  }
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(root, name), content)
  }
  const lock = 'lockfileVersion: 9\n'
  await writeFile(path.join(root, 'pnpm-lock.yaml'), lock)
  const frozen = snapshotConsumerInputs(files)
  await expect(assertConsumerInputs(root, frozen)).resolves.toBeUndefined()
  await expect(assertConsumerInputs(root, { ...frozen, inputFiles: frozen.inputFiles.filter(file => file !== contract) })).rejects.toThrow('installation contracts')
  await writeFile(path.join(root, contract), files[contract].replace('weapp-vite', 'changed-dependency'))
  expect(await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8')).toBe(lock)
  await expect(assertConsumerInputs(root, frozen)).rejects.toThrow('input changed')
})

it('resolves the installed nested dependency path and preserves optional missing edges', async () => {
  const root = await fixture()
  const core = path.join(root, 'node_modules/weapp-vite')
  await packageAt(core, { name: 'weapp-vite', version: '1', dependencies: { adapter: '1' }, optionalDependencies: { absent: '1' } })
  await packageAt(path.join(root, 'node_modules/adapter'), { name: 'adapter', version: 'outer' })
  await packageAt(path.join(core, 'node_modules/adapter'), { name: 'adapter', version: 'nested', dependencies: { axios: '1' } })
  await packageAt(path.join(root, 'node_modules/axios'), { name: 'axios', version: '1' })
  const graph = await inspectDependencyGraph(root)
  const chains = findDependencyPaths(graph, ['weapp-vite', 'adapter', 'axios'])
  expect(chains).toEqual([['node_modules/weapp-vite', 'node_modules/weapp-vite/node_modules/adapter', 'node_modules/axios']])
  expect(graph.edges).toContainEqual(expect.objectContaining({ name: 'absent', optional: true, to: null }))
  expect((await inspectInstallation(root)).fileBytes).toBeGreaterThan(0)
})

it('rejects a dependency link that escapes the installed consumer', async () => {
  const root = await fixture()
  const other = await fixture()
  await mkdir(path.join(root, 'node_modules'))
  await symlink(other, path.join(root, 'node_modules/weapp-vite'), 'junction')
  await expect(inspectDependencyGraph(root)).rejects.toThrow('escapes consumer')
  await expect(inspectInstallation(root)).rejects.toThrow('escapes consumer')
})

it('distinguishes dependency reachability, resolution and successful loading in a real hook process', async () => {
  const root = await fixture()
  await packageAt(path.join(root, 'node_modules/weapp-vite'), { name: 'weapp-vite', version: '1', type: 'module', exports: './index.mjs', dependencies: { unused: '1' } })
  await writeFile(path.join(root, 'node_modules/weapp-vite/index.mjs'), 'export const value = 1')
  await packageAt(path.join(root, 'node_modules/unused'), { name: 'unused', version: '1', type: 'module', exports: './index.mjs' })
  await writeFile(path.join(root, 'node_modules/unused/index.mjs'), 'throw new Error("must not execute")')
  await writeFile(path.join(root, 'entry.mjs'), 'await import("weapp-vite"); import.meta.resolve("unused")')
  const traceFile = path.join(root, 'trace.json')
  await execute(process.execPath, ['--import', new URL('./trace.mjs', import.meta.url).href, path.join(root, 'entry.mjs')], {
    cwd: root,
    env: { ...process.env, PROVIDER_COST_ROOT: root, PROVIDER_COST_TRACE: traceFile },
  })
  const trace = JSON.parse(await readFile(traceFile, 'utf8'))
  const graph = await inspectDependencyGraph(root)
  const summary = buildConsumerSummary(graph, trace)
  expect(summary.packages.find(pkg => pkg.name === 'weapp-vite')).toMatchObject({ loadedModules: 1 })
  expect(summary.packages.find(pkg => pkg.name === 'unused')).toMatchObject({ resolvedModules: 1, loadedModules: 0 })
  assert(!JSON.stringify(trace).includes(root))
  expect(() => buildConsumerSummary(graph, { ...trace, exitCode: 1 })).toThrow('successful')
  expect(() => buildConsumerSummary(graph, { ...trace, modules: [] })).toThrow('actual weapp-vite')
  const missing = { ...graph, edges: [...graph.edges, { name: 'required', optional: false, to: null }] }
  expect(() => buildConsumerSummary(missing, trace)).toThrow('unresolved required')
})
