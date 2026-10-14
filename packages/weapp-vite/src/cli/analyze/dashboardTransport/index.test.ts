import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { loadDashboardTransportModule } from './index'

let root: string

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-transport-')))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

async function createOwner(name: string) {
  const folder = path.join(root, name)
  await fs.mkdir(folder, { recursive: true })
  const manifest = path.join(folder, 'package.json')
  await fs.writeFile(manifest, JSON.stringify({ name: '@weapp-vite/dashboard', type: 'module' }))
  return { folder, manifest }
}

async function createModule(folder: string, name: string, entry: string, code: string) {
  const moduleRoot = path.join(folder, 'node_modules', name)
  await fs.mkdir(moduleRoot, { recursive: true })
  await fs.writeFile(path.join(moduleRoot, 'package.json'), JSON.stringify({
    name,
    type: 'module',
    exports: { [entry]: './entry.mjs' },
  }))
  await fs.writeFile(path.join(moduleRoot, 'entry.mjs'), code)
  return moduleRoot
}

it('loads the selected owner versions without selecting the parent installation', async () => {
  await createModule(root, '@devframes/hub', './initiate', 'export const fixtureOwner = "parent"')
  const first = await createOwner('first owner with spaces')
  const second = await createOwner('second-owner')
  await createModule(first.folder, '@devframes/hub', './initiate', 'export const fixtureOwner = "first"')
  await createModule(second.folder, '@devframes/hub', './initiate', 'export const fixtureOwner = "second"')
  const load = async (manifest: string) => await loadDashboardTransportModule(manifest, '@devframes/hub/initiate') as unknown as { fixtureOwner: string }
  expect((await load(first.manifest)).fixtureOwner).toBe('first')
  expect((await load(second.manifest)).fixtureOwner).toBe('second')
  expect((await load(first.manifest)).fixtureOwner).toBe('first')
})

it('preserves the virtual installation peer context after resolving a package symlink', async () => {
  const owner = await createOwner('dashboard')
  await createModule(root, 'devframe', '.', 'export const fixtureOwner = "parent-peer"')
  const store = path.join(root, 'virtual store', 'agentic-peer')
  const moduleRoot = await createModule(store, '@devframes/agentic', './mcp', 'export { fixtureOwner } from "devframe"')
  await createModule(store, 'devframe', '.', 'export const fixtureOwner = "owned-peer"')
  const link = path.join(owner.folder, 'node_modules', '@devframes', 'agentic')
  await fs.mkdir(path.dirname(link), { recursive: true })
  await fs.symlink(moduleRoot, link, process.platform === 'win32' ? 'junction' : 'dir')
  const adapter = await loadDashboardTransportModule(owner.manifest, '@devframes/agentic/mcp') as unknown as { fixtureOwner: string }
  expect(adapter.fixtureOwner).toBe('owned-peer')
})

it('reports a missing owner dependency while preserving its resolver error', async () => {
  const owner = await createOwner('missing-transport')
  await expect(loadDashboardTransportModule(owner.manifest, '@devframes/hub-ui')).rejects.toMatchObject({
    message: expect.stringContaining('Dashboard 无法解析传输依赖 @devframes/hub-ui'),
    cause: { code: 'MODULE_NOT_FOUND' },
  })
})

it('preserves a transport initialization failure instead of calling it a missing dependency', async () => {
  const owner = await createOwner('broken-transport')
  await createModule(owner.folder, '@devframes/hub-ui', '.', 'throw new Error("owned transport initialization failed")')
  await expect(loadDashboardTransportModule(owner.manifest, '@devframes/hub-ui')).rejects.toMatchObject({
    message: 'owned transport initialization failed',
  })
})

it('preserves a missing transitive import instead of falling back to a core adapter', async () => {
  const owner = await createOwner('missing-transitive')
  await createModule(owner.folder, '@devframes/hub-ui', '.', 'import "missing-dashboard-transport-transitive"')
  await expect(loadDashboardTransportModule(owner.manifest, '@devframes/hub-ui')).rejects.toMatchObject({
    code: 'ERR_MODULE_NOT_FOUND',
    message: expect.stringContaining('missing-dashboard-transport-transitive'),
  })
})
