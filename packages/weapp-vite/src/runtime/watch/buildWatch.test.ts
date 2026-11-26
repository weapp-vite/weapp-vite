import type { Stats } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createBuildWatchFilter } from './buildWatch'

const directoryStats = { isDirectory: () => true } as Stats
const fileStats = { isDirectory: () => false } as Stats

it('filters discovered files without pruning included directory trees', () => {
  const root = path.resolve('watch-filter-fixture')
  const filter = createBuildWatchFilter({
    include: ['src/**', '../shared/**'],
    exclude: ['**/ignored/**'],
  }, root, [path.join(root, 'vite.config.ts')])

  expect(filter.accepts(path.join(root, 'src/page.ts'))).toBe(true)
  expect(filter.accepts(path.resolve(root, '../shared/message.ts'))).toBe(true)
  expect(filter.accepts(path.resolve(root, '../shared/ignored/message.ts'))).toBe(false)
  expect(filter.accepts(path.join(root, 'src/ignored/page.ts'))).toBe(false)
  expect(filter.accepts(path.join(root, 'other/page.ts'))).toBe(false)
  expect(filter.accepts(path.join(root, 'vite.config.ts'))).toBe(true)
  expect(filter.ignored(path.join(root, 'src'), directoryStats)).toBe(false)
  expect(filter.ignored(path.join(root, 'src/page.ts'), fileStats)).toBe(false)
  expect(filter.ignored(path.join(root, 'other/page.ts'), fileStats)).toBe(true)
  expect(filter.ignored(path.join(root, 'src/ignored'), directoryStats)).toBe(true)
  expect(filter.ignored(path.join(root, 'src/other/page.ts'))).toBe(false)
  expect(filter.ignored(path.join(root, 'other/page.ts'))).toBe(true)
  expect(filter.ignored(root)).toBe(false)
})

it('applies ordered negated patterns to logical and physical aliases', () => {
  const root = path.resolve('watch-filter-negation')
  const filter = createBuildWatchFilter({
    include: ['src/**', '!src/ignored/**', 'src/ignored/keep.ts'],
    exclude: ['**/*.gen.ts', '!src/keep.gen.ts'],
  }, root)

  expect(filter.accepts(path.join(root, 'src/page.ts'))).toBe(true)
  expect(filter.accepts(path.join(root, 'src/ignored/page.ts'))).toBe(false)
  expect(filter.accepts(path.join(root, 'src/ignored/keep.ts'))).toBe(true)
  expect(filter.accepts(path.join(root, 'src/drop.gen.ts'))).toBe(false)
  expect(filter.accepts(path.join(root, 'src/keep.gen.ts'))).toBe(true)

  const excludedDirectory = createBuildWatchFilter({
    exclude: ['**/ignored/**', '!**/ignored/keep.ts'],
  }, root)
  expect(excludedDirectory.ignored(path.join(root, 'src/ignored'), directoryStats)).toBe(false)
  expect(excludedDirectory.accepts(path.join(root, 'src/ignored/keep.ts'))).toBe(true)
  expect(excludedDirectory.accepts(path.join(root, 'src/ignored/drop.ts'))).toBe(false)
})

it('treats a leading extglob as a positive pattern', () => {
  const root = path.resolve('watch-filter-extglob')
  const filter = createBuildWatchFilter({ include: ['src/!(ignored)/**'] }, root)

  expect(filter.accepts(path.join(root, 'src/page.ts'))).toBe(true)
  expect(filter.accepts(path.join(root, 'src/ignored/page.ts'))).toBe(false)

  const excluded = createBuildWatchFilter({ exclude: ['src/!(ignored)/**'] }, root)
  expect(excluded.accepts(path.join(root, 'src/page.ts'))).toBe(false)
  expect(excluded.accepts(path.join(root, 'src/ignored/page.ts'))).toBe(true)
})

it('reads always-watch files lazily after config resolution', () => {
  const root = path.resolve('watch-filter-dynamic-config')
  const dependencies: string[] = []
  const filter = createBuildWatchFilter({ include: ['src/**'] }, root, () => dependencies)
  const configDependency = path.join(root, 'config', 'value.mjs')

  expect(filter.accepts(configDependency)).toBe(false)
  dependencies.push(configDependency)
  expect(filter.accepts(configDependency)).toBe(true)
  expect(filter.ignored(configDependency, fileStats)).toBe(false)
  expect(filter.ignored(path.dirname(configDependency), directoryStats)).toBe(false)

  const excluded = createBuildWatchFilter({ exclude: ['config/**'] }, root, () => dependencies)
  expect(excluded.ignored(path.dirname(configDependency), directoryStats)).toBe(false)
  expect(excluded.ignored(configDependency, fileStats)).toBe(false)
  expect(excluded.ignored(path.join(root, 'config/other.mjs'), fileStats)).toBe(true)
})

it('matches and registers a workspace symlink by its physical source path', async () => {
  const container = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-watch-filter-link-')))
  const root = path.join(container, 'app')
  const packageRoot = path.join(container, 'packages/ui')
  const logicalRoot = path.join(root, 'node_modules/@scope/ui')
  try {
    await mkdir(path.dirname(logicalRoot), { recursive: true })
    await mkdir(packageRoot, { recursive: true })
    await writeFile(path.join(packageRoot, 'index.ts'), 'export const value = 1')
    await symlink(packageRoot, logicalRoot, 'junction')

    const include = createBuildWatchFilter({ include: ['node_modules/@scope/ui/**'] }, root)
    expect(include.targets).toEqual([packageRoot.replaceAll('\\', '/')])
    expect(include.accepts(path.join(packageRoot, 'index.ts'))).toBe(true)
    expect(include.accepts(path.join(logicalRoot, 'index.ts'))).toBe(true)

    const exclude = createBuildWatchFilter({ exclude: ['node_modules/@scope/ui/**'] }, root)
    expect(exclude.accepts(path.join(packageRoot, 'index.ts'))).toBe(false)
    expect(exclude.accepts(path.join(logicalRoot, 'index.ts'))).toBe(false)

    const configDependency = createBuildWatchFilter({ include: ['other/**'] }, root, [logicalRoot])
    expect(configDependency.accepts(path.join(packageRoot, 'index.ts'))).toBe(true)
  }
  finally {
    await rm(container, { recursive: true, force: true })
  }
})

it('keeps logical targets when preserveSymlinks is enabled', () => {
  const root = path.resolve('watch-filter-preserve')
  const filter = createBuildWatchFilter({
    include: ['../shared/**'],
    preserveSymlinks: true,
  }, root)

  expect(filter.targets).toEqual([path.resolve(root, '../shared').replaceAll('\\', '/')])
})
