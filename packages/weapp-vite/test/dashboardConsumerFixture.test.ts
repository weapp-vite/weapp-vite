import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it } from 'vitest'
import { parse, stringify } from 'yaml'
import { assertDashboardConsumerPeerGraph, assertDashboardIsolationWorkspace, createDashboardIsolationWorkspace } from '../scripts/dashboardConsumerFixture.mjs'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

it('preserves the candidate closure and build approvals while disabling both optional-peer merging paths', () => {
  const candidates = { 'weapp-vite': 'file:core.tgz', '@weapp-vite/dashboard': 'file:dashboard.tgz' }
  const workspace = createDashboardIsolationWorkspace(candidates, 'consumer')
  const installed = parse(stringify(workspace)) as Record<string, unknown>
  expect(() => assertDashboardIsolationWorkspace(installed)).not.toThrow()
  expect(installed).toMatchObject({
    packages: [],
    nodeLinker: 'isolated',
    hoist: false,
    shamefullyHoist: false,
    linkWorkspacePackages: false,
    enableGlobalVirtualStore: false,
    overrides: candidates,
  })
  expect(installed.allowBuilds).toEqual({ '@parcel/watcher': false, '@swc/core': true, 'esbuild': true })
  expect(workspace.overrides).not.toBe(candidates)
  expect(candidates).toEqual({ 'weapp-vite': 'file:core.tgz', '@weapp-vite/dashboard': 'file:dashboard.tgz' })
})

it.each([
  { autoInstallPeers: true, dedupePeerDependents: false },
  { autoInstallPeers: false, dedupePeerDependents: true },
  { autoInstallPeers: false },
  { dedupePeerDependents: false },
  { autoInstallPeers: false, dedupePeerDependents: false, strictPeerDependencies: false },
])('rejects incomplete isolation policy %j', (policy) => {
  expect(() => assertDashboardIsolationWorkspace({ strictPeerDependencies: true, ...policy })).toThrow()
})

async function packageAt(root: string, slot: string, name: string) {
  const modules = path.join(root, 'node_modules', '.pnpm', slot, 'node_modules')
  const directory = path.join(modules, name)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({
    name,
    version: '1.2.3',
    type: 'module',
    ...(name === 'devframe' ? { exports: { './package.json': './package.json', './node/auth': './auth.mjs' } } : {}),
  }))
  if (name === 'devframe') {
    await writeFile(path.join(directory, 'auth.mjs'), '')
  }
  return { modules, directory }
}

async function link(modules: string, name: string, directory: string) {
  const target = path.join(modules, name)
  await mkdir(path.dirname(target), { recursive: true })
  await symlink(directory, target, process.platform === 'win32' ? 'junction' : 'dir')
}

async function peerFixture(options: { shared?: boolean, leaked?: boolean, foreignPeer?: boolean, escaped?: boolean } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dashboard-consumer-peer-'))
  roots.push(root)
  await writeFile(path.join(root, 'package.json'), '{"private":true,"type":"module"}')
  const core = await packageAt(root, 'core', 'weapp-vite')
  const owner = await packageAt(root, 'dashboard', '@weapp-vite/dashboard')
  const corePeer = await packageAt(root, 'core-peer', 'devframe')
  const ownerPeer = await packageAt(root, 'dashboard-peer', 'devframe')
  await link(path.join(root, 'node_modules'), 'weapp-vite', core.directory)
  await link(path.join(root, 'node_modules'), '@weapp-vite/dashboard', owner.directory)
  await link(core.modules, 'devframe', options.shared ? ownerPeer.directory : corePeer.directory)
  await link(owner.modules, 'devframe', ownerPeer.directory)
  for (const name of ['@devframes/agentic', '@devframes/hub', '@devframes/hub-ui']) {
    const transport = await packageAt(root, name.slice(name.indexOf('/') + 1), name)
    await link(owner.modules, name, transport.directory)
    await link(transport.modules, 'devframe', options.foreignPeer && name === '@devframes/hub' ? corePeer.directory : ownerPeer.directory)
    if (name === '@devframes/agentic') {
      await link(ownerPeer.modules, name, transport.directory)
    }
    if (name === '@devframes/agentic' && options.leaked) {
      await link(corePeer.modules, name, transport.directory)
    }
  }
  if (options.escaped) {
    const outside = await mkdtemp(path.join(os.tmpdir(), 'dashboard-consumer-external-'))
    roots.push(outside)
    const external = await packageAt(outside, 'external', '@weapp-vite/dashboard')
    await rm(path.join(root, 'node_modules', '@weapp-vite/dashboard'))
    await link(path.join(root, 'node_modules'), '@weapp-vite/dashboard', external.directory)
  }
  return root
}

it('accepts separated physical peers with one shared Dashboard transport and auth identity', async () => {
  const graph = assertDashboardConsumerPeerGraph(await peerFixture())
  expect(graph.coreDevframe).not.toBe(graph.ownerDevframe)
  expect(graph.transportManifests).toHaveLength(3)
})

it('rejects the observed merged optional-peer graph instead of recording it as isolated coverage', async () => {
  const root = await peerFixture({ shared: true })
  expect(() => assertDashboardConsumerPeerGraph(root)).toThrow('Strict pnpm case failed to exercise separated optional-peer graphs')
})

it('rejects optional agentic leaking into the separate core peer', async () => {
  const root = await peerFixture({ leaked: true })
  expect(() => assertDashboardConsumerPeerGraph(root)).toThrow('Core devframe acquired the optional agentic peer in the isolation case')
})

it('rejects a transport resolving another devframe identity', async () => {
  const root = await peerFixture({ foreignPeer: true })
  expect(() => assertDashboardConsumerPeerGraph(root)).toThrow('Transitive peer devframe does not share the selected Dashboard owner')
})

it('rejects a Dashboard package link outside the consumer installation', async () => {
  const root = await peerFixture({ escaped: true })
  expect(() => assertDashboardConsumerPeerGraph(root)).toThrow('Installed module escaped consumer node_modules')
})

it('rejects an entire node_modules directory linked from another installation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dashboard-consumer-root-'))
  roots.push(root)
  const installed = await peerFixture()
  await writeFile(path.join(root, 'package.json'), '{"private":true,"type":"module"}')
  await symlink(path.join(installed, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  expect(() => assertDashboardConsumerPeerGraph(root)).toThrow('Consumer node_modules escaped the physical installation root')
})
