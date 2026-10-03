import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { createDependenciesCache } from './cache'

function createContext(packageFiles: Record<string, { include?: string[], exclude?: string[] }>) {
  return {
    configService: {
      cwd: process.cwd(),
      packageJson: {
        dependencies: {
          'mini-pkg': '1.0.0',
        },
      },
      weappViteConfig: {
        npm: {
          packageFiles,
        },
      },
    },
  } as any
}

describe('npm dependencies cache', () => {
  it('invalidates when package file filters change', () => {
    const dialogHash = createDependenciesCache(createContext({
      'mini-pkg': {
        include: ['dialog/**'],
      },
    })).dependenciesCacheHash()
    const buttonHash = createDependenciesCache(createContext({
      'mini-pkg': {
        include: ['button/**'],
      },
    })).dependenciesCacheHash()

    expect(dialogHash).not.toBe(buttonHash)
  })

  it('invalidates from the selected manual manifest while the project manifest stays unchanged', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-npm-manifest-cache-'))
    try {
      const manifestPath = path.join(root, 'npm-config/package.json')
      await mkdir(path.dirname(manifestPath))
      await writeFile(manifestPath, JSON.stringify({ dependencies: { 'nested-card': '1.0.0' } }))
      const context = createContext({})
      context.configService.cwd = root
      context.configService.projectConfig = { setting: { packNpmManually: true, packNpmRelationList: [{ packageJsonPath: 'npm-config/package.json', miniprogramNpmDistDir: 'dist' }] } }
      context.configService.weappViteConfig.npm.cache = true
      const cache = createDependenciesCache(context)
      await cache.writeDependenciesCache()
      expect(await cache.checkDependenciesCacheOutdate()).toBe(false)
      await writeFile(manifestPath, JSON.stringify({ dependencies: { 'nested-card': '2.0.0' } }))
      expect(await cache.checkDependenciesCacheOutdate()).toBe(true)
      await cache.writeDependenciesCache()
      await writeFile(manifestPath, JSON.stringify({ dependencies: { 'nested-card': '2.0.0' }, devDependencies: { 'dev-card': '1.0.0' } }))
      expect(await cache.checkDependenciesCacheOutdate()).toBe(true)
      expect(context.configService.packageJson.dependencies).toEqual({ 'mini-pkg': '1.0.0' })
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
