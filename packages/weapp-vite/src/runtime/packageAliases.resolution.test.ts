import os from 'node:os'
import path from 'pathe'
import { beforeEach, expect, it, vi } from 'vitest'
import { resolveBuiltinPackageAliases } from './packageAliases'

const { existsSyncMock, getPackageInfoSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  getPackageInfoSyncMock: vi.fn(),
}))

vi.mock('node:fs', () => ({ existsSync: existsSyncMock }))
vi.mock('./localPkg', () => ({ safeGetPackageInfoSync: getPackageInfoSyncMock }))
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }))

const cwd = path.join(os.tmpdir(), 'builtin-alias-resolution')

beforeEach(() => {
  vi.clearAllMocks()
  getPackageInfoSyncMock.mockReturnValue(undefined)
  existsSyncMock.mockReturnValue(false)
})

function packageReads(packageName: string) {
  return getPackageInfoSyncMock.mock.calls.filter(([name]) => name === packageName)
}

it('resolves each project package once while checking every distinct alias entry', () => {
  const roots = new Map(['@weapp-core/shared', 'wevu', 'class-variance-authority'].map(name => [name, path.join(cwd, 'node_modules', name)]))
  getPackageInfoSyncMock.mockImplementation((name: string) => roots.has(name) ? { rootPath: roots.get(name) } : undefined)
  existsSyncMock.mockImplementation((file: string) => file.startsWith(cwd) && file.includes('/dist/'))

  const aliases = resolveBuiltinPackageAliases({ cwd, isDev: true })

  expect(aliases).toHaveLength(14)
  expect(packageReads('@weapp-core/shared')).toHaveLength(1)
  expect(packageReads('wevu')).toHaveLength(1)
  for (const { replacement } of aliases) {
    expect(existsSyncMock).toHaveBeenCalledWith(replacement)
  }
  expect(aliases).toContainEqual({ find: 'wevu/compiler', replacement: path.join(roots.get('wevu')!, 'dist/dev/compiler.mjs') })
  expect(aliases).toContainEqual({ find: '@weapp-core/shared/platforms/runtime', replacement: path.join(roots.get('@weapp-core/shared')!, 'dist/platforms/runtime/index.js') })
})

it('resolves missing project packages once within one synchronous alias resolution', () => {
  expect(resolveBuiltinPackageAliases({ cwd })).toEqual([])
  expect(packageReads('@weapp-core/shared')).toHaveLength(1)
  expect(packageReads('wevu')).toHaveLength(1)
})

it('reads packages again after installation or root replacement between resolutions', () => {
  let wevuRoot: string | undefined
  getPackageInfoSyncMock.mockImplementation((name: string) => name === 'wevu' && wevuRoot ? { rootPath: wevuRoot } : undefined)
  existsSyncMock.mockImplementation((file: string) => Boolean(wevuRoot && file.startsWith(`${wevuRoot}/dist/`)))
  expect(resolveBuiltinPackageAliases({ cwd })).toEqual([])
  for (const installedRoot of [path.join(cwd, 'wevu-first'), path.join(cwd, 'wevu-replaced')]) {
    wevuRoot = installedRoot
    expect(resolveBuiltinPackageAliases({ cwd })).toContainEqual({ find: 'wevu', replacement: path.join(installedRoot, 'dist/index.mjs') })
  }
  wevuRoot = undefined
  expect(resolveBuiltinPackageAliases({ cwd })).toEqual([])
  expect(packageReads('wevu')).toHaveLength(4)
})

it('checks each subpath independently when only part of a package is installed', () => {
  const rootPath = path.join(cwd, 'wevu-partial')
  getPackageInfoSyncMock.mockImplementation((name: string) => name === 'wevu' ? { rootPath } : undefined)
  const entries = new Set(['dist/index.mjs', 'dist/store.mjs'].map(entry => path.join(rootPath, entry)))
  existsSyncMock.mockImplementation((file: string) => entries.has(file))

  expect(resolveBuiltinPackageAliases({ cwd })).toEqual([
    { find: 'wevu', replacement: path.join(rootPath, 'dist/index.mjs') },
    { find: 'wevu/store', replacement: path.join(rootPath, 'dist/store.mjs') },
  ])
  expect(packageReads('wevu')).toHaveLength(1)
  expect(existsSyncMock).toHaveBeenCalledWith(path.join(rootPath, 'dist/compiler.mjs'))
})

it('keeps the compatible builder copy separate from the project package lookup', () => {
  const builderRoot = path.join(cwd, 'builder')
  const bundledRoot = path.join(cwd, 'bundled-wevu')
  const projectRoot = path.join(cwd, 'project-wevu')
  const builderSearch = path.join(builderRoot, '.weapp-vite-package-resolution.mjs')
  getPackageInfoSyncMock.mockImplementation((name: string, options?: { paths?: string[] }) => {
    if (name === 'weapp-vite') {
      return { rootPath: builderRoot, packageJson: { dependencies: { wevu: '7.5.0' } } }
    }
    if (name === 'wevu') {
      return options?.paths?.[0] === builderSearch
        ? { rootPath: bundledRoot, version: '7.5.0' }
        : { rootPath: projectRoot, version: '7.4.0' }
    }
    return undefined
  })
  existsSyncMock.mockImplementation((file: string) => file.startsWith(`${bundledRoot}/dist/`))

  const aliases = resolveBuiltinPackageAliases({ cwd })

  expect(aliases).toHaveLength(11)
  expect(aliases.every(alias => alias.replacement.startsWith(`${bundledRoot}/dist/`))).toBe(true)
  expect(packageReads('wevu')).toEqual([
    ['wevu', { paths: [builderSearch] }],
    ['wevu', { paths: [path.join(cwd, '.weapp-vite-package-resolution.mjs')] }],
  ])
})
