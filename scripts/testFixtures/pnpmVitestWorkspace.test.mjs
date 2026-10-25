import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 空缓存回归使用真实 pnpm，验证离线安装及执行门禁。
import { execa } from 'execa'
import { afterEach, expect, it, vi } from 'vitest'
import { parseAllDocuments, stringify } from 'yaml'
import { createPnpmVitestFixtureLock, preparePnpmVitestFixture } from './pnpmVitestWorkspace.mjs'

const require = createRequire(import.meta.url)
const roots = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'pnpm-vitest-offline-')))
  roots.push(root)
  const directory = path.join(root, 'project')
  await mkdir(directory)
  for (const kind of ['cache', 'store', 'state']) {
    vi.stubEnv(`PNPM_CONFIG_${kind.toUpperCase()}_DIR`, path.join(root, kind))
  }
  vi.stubEnv('CI', 'true')
  vi.stubEnv('PNPM_CONFIG_OFFLINE', 'true')
  await preparePnpmVitestFixture(directory, { private: true, type: 'module' })
  return { directory, root }
}

it('isolates root configuration and project dependencies while retaining the locked package-manager resolution', () => {
  const manager = { specifier: '12.15.0', version: '12.15.0' }
  const packages = { 'pnpm@12.15.0': { resolution: { integrity: 'frozen-manager-integrity' } } }
  const snapshots = { 'pnpm@12.15.0': {} }
  const source = `---\n${stringify({
    lockfileVersion: '9.0',
    importers: {
      '.': { configDependencies: { 'fixture-config': { specifier: '1.0.0', version: '1.0.0' } }, packageManagerDependencies: { pnpm: manager } },
      'other': { configDependencies: { 'other-config': { specifier: '1.0.0', version: '1.0.0' } } },
    },
    packages,
    snapshots,
  })}---\n${stringify({ lockfileVersion: '9.0', importers: { '.': { dependencies: { 'project-only': '1.0.0' } } } })}`
  const documents = parseAllDocuments(createPnpmVitestFixtureLock('pnpm@12.15.0', source)).map(document => document.toJS())
  expect(documents).toEqual([
    { lockfileVersion: '9.0', importers: { '.': { configDependencies: {}, packageManagerDependencies: { pnpm: manager } } }, packages, snapshots },
    { lockfileVersion: '9.0' },
  ])
  expect(() => createPnpmVitestFixtureLock('pnpm@0.0.0', source)).toThrow('does not match pnpm@0.0.0')
})

it('prepares and executes real Vitest in CI with an empty offline cache and the frozen package-manager identity', async () => {
  const { directory, root } = await fixture()
  const result = await execa('pnpm', ['exec', 'vitest', '--version'], { cwd: directory })
  const { version } = JSON.parse(await readFile(require.resolve('vitest/package.json'), 'utf8'))
  expect(result.stdout).toContain(`vitest/${version}`)
  expect((await lstat(path.join(directory, 'node_modules'))).isSymbolicLink()).toBe(false)
  const repository = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
  expect(manifest.packageManager).toBe(repository.packageManager)
  const metadata = await readdir(path.join(root, 'cache'), { recursive: true }).catch((error) => {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  })
  expect(metadata.some(file => path.basename(file) === 'pnpm.jsonl')).toBe(false)
}, 30_000)

it('retains the actual package-manager version error without attempting an offline self-download', async () => {
  const { directory } = await fixture()
  const file = path.join(directory, 'package.json')
  const manifest = JSON.parse(await readFile(file, 'utf8'))
  manifest.packageManager = 'pnpm@0.0.0'
  await writeFile(file, JSON.stringify(manifest))
  const result = await execa('pnpm', ['exec', 'vitest', '--version'], { cwd: directory, reject: false })
  expect(result.exitCode).not.toBe(0)
  expect(result.stderr).toContain('ERR_PNPM_BAD_PM_VERSION')
  expect(result.stderr).toContain('0.0.0')
}, 30_000)

it('rejects fixture dependency changes during frozen offline installation', async () => {
  const { directory } = await fixture()
  const file = path.join(directory, 'package.json')
  const manifest = JSON.parse(await readFile(file, 'utf8'))
  manifest.devDependencies.vitest = '0.0.0'
  await writeFile(file, JSON.stringify(manifest))
  const result = await execa('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'], { cwd: directory, reject: false })
  expect(result.exitCode).not.toBe(0)
  expect(result.stderr).toContain('ERR_PNPM_OUTDATED_LOCKFILE')
}, 30_000)
