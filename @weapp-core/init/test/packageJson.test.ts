import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as npm from '@/npm'
import { createDefaultPackageJson, createOrUpdatePackageJson, upsertDependencyVersion } from '@/packageJson'
import * as fsUtils from '@/utils/fs'
import { logger } from '../vitest.setup'

describe('packageJson', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates default package.json when missing and writes scripts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-pkg-'))
    vi.spyOn(npm, 'latestVersion')
      .mockResolvedValueOnce('^1.0.0')
      .mockResolvedValueOnce('^2.0.0')

    const pkg = await createOrUpdatePackageJson({ root, command: 'weapp-vite' })
    const saved = await fs.readJSON(path.join(root, 'package.json'))

    expect(pkg.scripts?.dev).toBe('weapp-vite dev')
    expect(saved.scripts?.build).toBe('weapp-vite build')
    expect(saved.devDependencies['weapp-vite']).toMatch(/^\^/)
    expect(saved.devDependencies['miniprogram-api-typings']).toBe('^1.0.0')
    expect(saved.devDependencies.typescript).toBe('^2.0.0')
  })

  it('respects callbacks and skipNetwork flag when write is false', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-pkg-no-write-'))
    const pkg = await createOrUpdatePackageJson({
      root,
      write: false,
      cb(set) {
        set('name', 'custom-app')
      },
    })

    expect(pkg.name).toBe('custom-app')
    expect(pkg.devDependencies?.['miniprogram-api-typings']).toBe('^4.1.0')
    expect(await fs.pathExists(path.join(root, 'package.json'))).toBe(false)
  })

  it('skips weapp-vite specific additions when command differs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-pkg-custom-'))
    const pkg = await createOrUpdatePackageJson({
      root,
      write: false,
      command: 'custom' as any,
    })

    expect(pkg.scripts?.open).toBeUndefined()
    expect(pkg.devDependencies?.['weapp-vite']).toBeUndefined()
  })

  it('updates existing package.json without recreating defaults', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-pkg-existing-'))
    const packagePath = path.join(root, 'package.json')
    const { version: weappViteVersion } = await fs.readJSON(
      path.resolve(import.meta.dirname, '../../..', 'packages/weapp-vite/package.json'),
    )
    await fs.outputJSON(packagePath, {
      name: 'existing-app',
      scripts: { lint: 'pnpm lint' },
      devDependencies: { 'weapp-vite': 'workspace:*' },
    })

    vi.spyOn(npm, 'latestVersion').mockResolvedValue('^1.0.0')
    const pkg = await createOrUpdatePackageJson({ root, write: false })

    expect(pkg.name).toBe('existing-app')
    expect(pkg.scripts?.lint).toBe('pnpm lint')
    expect(pkg.devDependencies?.['weapp-vite']).toBe(`^${weappViteVersion}`)
  })

  it('upsertDependencyVersion handles resolved and fallback values', async () => {
    const pkg: any = {}
    await upsertDependencyVersion(pkg, 'devDependencies.demo', 'demo', { skipNetwork: true })
    expect(pkg.devDependencies.demo).toBe('latest')

    const withExisting = { devDependencies: { demo: '1.0.0' } }
    vi.spyOn(npm, 'latestVersion').mockResolvedValueOnce('^9.9.9')
    await upsertDependencyVersion(withExisting, 'devDependencies.demo', 'demo')
    expect(withExisting.devDependencies.demo).toBe('^9.9.9')

    const keepExisting = { devDependencies: { demo: 'kept' } }
    vi.spyOn(npm, 'latestVersion').mockResolvedValueOnce(null)
    await upsertDependencyVersion(keepExisting, 'devDependencies.demo', 'demo')
    expect(keepExisting.devDependencies.demo).toBe('kept')
  })

  it('rethrows and logs when creation fails', async () => {
    vi.spyOn(fsUtils, 'readJsonIfExists').mockRejectedValue(new Error('boom'))

    await expect(createOrUpdatePackageJson({ root: os.tmpdir() })).rejects.toThrow('boom')
    expect(logger.error).toHaveBeenCalled()
  })

  it('exposes a reusable default package.json template', () => {
    const pkg = createDefaultPackageJson()
    expect(pkg.name).toBe('weapp-vite-app')
    expect(pkg.devDependencies).toEqual({})
    expect(pkg.scripts).toEqual({})
  })
})
