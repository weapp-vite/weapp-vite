import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createMiniProgramPackageResolver, getAncestorNodeModulesPaths } from '../src/plugin/packageResolution'

describe('Web package resolution', () => {
  it('includes hoisted ancestor node_modules directories for Sass resolution', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'weapp-web-workspace-'))
    const appRoot = join(workspaceRoot, 'packages/app')
    const paths = getAncestorNodeModulesPaths(appRoot)

    expect(paths.slice(0, 3)).toEqual([
      join(appRoot, 'node_modules'),
      join(dirname(appRoot), 'node_modules'),
      join(workspaceRoot, 'node_modules'),
    ])
  })

  it('maps package subpaths through the miniprogram manifest field', async () => {
    const packageRoot = await mkdtemp(join(tmpdir(), 'weapp-web-package-'))
    const manifestPath = join(packageRoot, 'package.json')
    const componentPath = join(packageRoot, 'miniprogram_dist/button/button.js')
    await mkdir(dirname(componentPath), { recursive: true })
    await writeFile(manifestPath, JSON.stringify({ miniprogram: 'miniprogram_dist' }))
    await writeFile(componentPath, 'Component({})')

    const resolveModule = createMiniProgramPackageResolver((id) => {
      if (id === 'component-library/package.json') {
        return manifestPath
      }
      throw new Error(`Unknown package: ${id}`)
    })

    expect(await resolveModule('component-library/button/button')).toBe(componentPath)
    expect(await resolveModule('component-library')).toBeUndefined()
    expect(await resolveModule('./button/button')).toBeUndefined()
    expect(await resolveModule('missing-library/button/button')).toBeUndefined()
  })

  it('recovers hoisted miniprogram entries after Vite alias rewriting', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'weapp-web-workspace-'))
    const packageRoot = join(workspaceRoot, 'node_modules/component-library')
    const manifestPath = join(packageRoot, 'package.json')
    const componentPath = join(packageRoot, 'miniprogram_dist/dialog/index.js')
    const webComponentPath = join(packageRoot, 'dist/dialog/index.js')
    await mkdir(dirname(componentPath), { recursive: true })
    await mkdir(dirname(webComponentPath), { recursive: true })
    await writeFile(manifestPath, JSON.stringify({ miniprogram: 'miniprogram_dist' }))
    await writeFile(componentPath, 'export default {}')
    await writeFile(webComponentPath, 'export default {}')

    const resolveModule = createMiniProgramPackageResolver((id) => {
      if (id === 'component-library/package.json') {
        return manifestPath
      }
      throw new Error(`Unknown package: ${id}`)
    })
    const aliasedPath = join(
      workspaceRoot,
      'packages/app/node_modules/component-library/dist/dialog',
    )

    expect(await resolveModule('component-library/dialog')).toBe(componentPath)
    expect(await resolveModule(aliasedPath)).toBe(webComponentPath)
  })
})
