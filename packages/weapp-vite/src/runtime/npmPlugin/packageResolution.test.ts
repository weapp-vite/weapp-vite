import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { getPackageInfo, getPackageInfoSync, resolveModule } from 'local-pkg'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { packageSearchOptions } from './packageResolution'

const roots: string[] = []

async function createProject() {
  const root = path.normalize(await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-package-resolution-'))))
  roots.push(root)
  const project = path.join(root, 'nested-project')
  await mkdir(project)
  await writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'fixture-project' }))
  return { root, project }
}

async function installFixture(root: string, name: string, version: string) {
  const packageRoot = path.join(root, 'node_modules', name)
  await mkdir(packageRoot, { recursive: true })
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name, version, main: 'index.js' }))
  await writeFile(path.join(packageRoot, 'index.js'), 'module.exports = {}')
  return packageRoot
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('npm package resolution directory boundary', () => {
  it('prefers the project dependency over the same package in its parent', async () => {
    const { root, project } = await createProject()
    await installFixture(root, 'fixture-dependency', '1.0.0')
    const nearest = await installFixture(project, 'fixture-dependency', '2.0.0')
    const options = packageSearchOptions(project)

    expect(getPackageInfoSync('fixture-dependency', options)?.version).toBe('2.0.0')
    expect((await getPackageInfo('fixture-dependency', options))?.version).toBe('2.0.0')
    expect(path.normalize(resolveModule('fixture-dependency', options)!)).toBe(path.join(nearest, 'index.js'))
  })

  it('still resolves dependencies installed in an ancestor', async () => {
    const { root, project } = await createProject()
    await installFixture(root, 'fixture-ancestor', '1.0.0')

    expect(getPackageInfoSync('fixture-ancestor', packageSearchOptions(project))?.version).toBe('1.0.0')
    expect((await getPackageInfo('fixture-ancestor', packageSearchOptions(project)))?.version).toBe('1.0.0')
  })

  it('returns missing dependencies without attempting to open package.json as a directory', async () => {
    const { project } = await createProject()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const options = packageSearchOptions(project)

    expect(getPackageInfoSync('missing-fixture-dependency', options)).toBeUndefined()
    expect(await getPackageInfo('missing-fixture-dependency', options)).toBeUndefined()
    expect(resolveModule('missing-fixture-dependency', options)).toBeUndefined()
    expect(error).not.toHaveBeenCalled()
  })

  it('keeps the resolver default when no directory is supplied', () => {
    expect(packageSearchOptions()).toBeUndefined()
  })
})
