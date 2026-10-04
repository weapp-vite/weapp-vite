import { lstat, mkdir, mkdtemp, readFile, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { linkBenchmarkDependencies } from '../scripts/utils/benchmarkDependencies'

let temporaryRoot: string
let sharedModules: string
let sharedPackage: string
let candidatePackage: string
let project: string

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'benchmark-dependencies-'))
  sharedModules = path.join(temporaryRoot, 'workspace/node_modules')
  sharedPackage = path.join(temporaryRoot, 'workspace/packages/weapp-vite')
  candidatePackage = path.join(temporaryRoot, 'candidate/packages/weapp-vite')
  project = path.join(temporaryRoot, 'fixtures/run/project')
  for (const directory of [sharedModules, sharedPackage, candidatePackage, project, path.join(sharedModules, '@borrowed/tool')]) {
    await mkdir(directory, { recursive: true })
  }
  await symlink(sharedPackage, path.join(sharedModules, 'weapp-vite'), 'junction')
  await writeFile(path.join(sharedPackage, 'index.js'), 'module.exports = "shared"')
  await writeFile(path.join(candidatePackage, 'index.js'), 'module.exports = "candidate"')
  await writeFile(path.join(sharedModules, '@borrowed/tool/index.js'), 'module.exports = "borrowed"')
  await writeFile(path.join(sharedModules, '.modules.yaml'), 'shared installation metadata\n')
})

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true })
})

it('selects the candidate through private fixture links without changing the shared installation', async () => {
  const sharedAlias = path.join(sharedModules, 'weapp-vite')
  const originalTarget = await readlink(sharedAlias)
  await linkBenchmarkDependencies(project, sharedModules, candidatePackage)
  expect(await readlink(sharedAlias)).toBe(originalTarget)
  expect(await realpath(sharedAlias)).toBe(await realpath(sharedPackage))
  expect((await lstat(path.join(project, 'node_modules'))).isSymbolicLink()).toBe(false)
  const require = createRequire(path.join(project, 'package.json'))
  expect(require('weapp-vite')).toBe('candidate')
  expect(require('@borrowed/tool')).toBe('borrowed')
  await rm(project, { recursive: true })
  expect(await realpath(sharedAlias)).toBe(await realpath(sharedPackage))
  expect(await readFile(path.join(sharedModules, '.modules.yaml'), 'utf8')).toBe('shared installation metadata\n')
})

it('refuses to replace a dependency directory that the fixture does not own', async () => {
  const fixtureModules = path.join(project, 'node_modules')
  await symlink(sharedModules, fixtureModules, 'junction')
  const originalTarget = await readlink(path.join(sharedModules, 'weapp-vite'))
  await expect(linkBenchmarkDependencies(project, sharedModules, candidatePackage)).rejects.toMatchObject({ code: 'EEXIST' })
  expect(await realpath(fixtureModules)).toBe(await realpath(sharedModules))
  expect(await readlink(path.join(sharedModules, 'weapp-vite'))).toBe(originalTarget)
})

it('resolves borrowed relative package aliases from their original installation', async () => {
  const packageDirectory = path.join(sharedModules, '.pnpm/borrowed/node_modules/borrowed')
  await mkdir(packageDirectory, { recursive: true })
  await writeFile(path.join(packageDirectory, 'index.js'), 'module.exports = "original installation"')
  await symlink(path.relative(sharedModules, packageDirectory), path.join(sharedModules, 'borrowed'), 'junction')
  await linkBenchmarkDependencies(project, sharedModules, candidatePackage)

  const require = createRequire(path.join(project, 'package.json'))
  expect(require('borrowed')).toBe('original installation')
  await rm(project, { recursive: true })
  expect(await realpath(path.join(sharedModules, 'borrowed'))).toBe(await realpath(packageDirectory))
})

it('removes only the private directory when preparation fails', async () => {
  await expect(linkBenchmarkDependencies(project, path.join(temporaryRoot, 'missing'), candidatePackage)).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(lstat(path.join(project, 'node_modules'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await realpath(path.join(sharedModules, 'weapp-vite'))).toBe(await realpath(sharedPackage))
})

it('preserves resolution of synthetic packages from the fixture parent', async () => {
  const syntheticPackage = path.join(project, '../node_modules/@vant/weapp')
  await mkdir(syntheticPackage, { recursive: true })
  await writeFile(path.join(syntheticPackage, 'index.js'), 'module.exports = "synthetic"')
  await linkBenchmarkDependencies(project, sharedModules, candidatePackage)

  const require = createRequire(path.join(project, 'package.json'))
  expect(require('@vant/weapp')).toBe('synthetic')
  expect(require('weapp-vite')).toBe('candidate')
})
