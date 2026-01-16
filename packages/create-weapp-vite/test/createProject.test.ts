import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, vi } from 'vitest'
import { __internal as createProjectInternal } from '@/createProject'
import { TemplateName } from '@/enums'
import { createProject } from '@/index'
import * as npm from '@/npm'
import { logger } from '../vitest.setup'

async function scanFiles(root: string) {
  const out: string[] = []

  async function walk(dir: string, base = '') {
    const entries = await fs.readdir(dir)
    for (const entry of entries) {
      const full = path.join(dir, entry)
      const rel = path.join(base, entry)
      const stat = await fs.stat(full)
      if (stat.isDirectory()) {
        await walk(full, rel)
      }
      else {
        out.push(rel)
      }
    }
  }

  if (await fs.pathExists(root)) {
    await walk(root)
  }

  return out.sort((a, b) => a.localeCompare(b))
}

describe('createProject', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function createTmpRoot(suffix: string) {
    return await fs.mkdtemp(path.join(os.tmpdir(), `weapp-create-${suffix}-`))
  }

  it('creates default template with resolved versions and gitignore rename', async () => {
    const root = await createTmpRoot('default')
    const { version: weappViteVersion } = await fs.readJSON(
      path.resolve(import.meta.dirname, '../../..', 'packages/weapp-vite/package.json'),
    )

    vi.spyOn(npm, 'latestVersion').mockResolvedValue('^9.9.9')

    await createProject(root, TemplateName.default)

    const pkgJson = await fs.readJSON(path.join(root, 'package.json'))
    expect(pkgJson.devDependencies['weapp-vite']).toBe(`^${weappViteVersion}`)
    expect(pkgJson.devDependencies['weapp-tailwindcss']).toBe('^9.9.9')
    expect(await fs.pathExists(path.join(root, '.gitignore'))).toBe(true)
    expect(await fs.pathExists(path.join(root, 'gitignore'))).toBe(false)
    const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8')
    expect(gitignore).toContain('node_modules')

    const files = await scanFiles(root)
    expect(files).toContain('package.json')
  })

  it('preserves existing .gitignore when templates ship gitignore', async () => {
    const root = await createTmpRoot('existing-ignore')
    await fs.outputFile(path.join(root, '.gitignore'), '# existing entry\n')

    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.tailwindcss)

    const templateRoot = path.resolve(import.meta.dirname, '../templates', TemplateName.tailwindcss)
    const templatePkgJson = await fs.readJSON(path.join(templateRoot, 'package.json'))
    const pkgJson = await fs.readJSON(path.join(root, 'package.json'))
    expect(pkgJson.devDependencies['weapp-tailwindcss']).toBe(templatePkgJson.devDependencies['weapp-tailwindcss'])
    const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8')
    expect(gitignore).toContain('# existing entry')
    expect(await fs.pathExists(path.join(root, 'gitignore'))).toBe(false)
  })

  it('initializes devDependencies when template package misses the field', async () => {
    const root = await createTmpRoot('no-devdeps')
    const templatePath = path.resolve(import.meta.dirname, '../templates', TemplateName.default)
    const templatePackagePath = path.join(templatePath, 'package.json')
    const originalPathExists = fs.pathExists.bind(fs)
    const originalReadJSON = fs.readJSON.bind(fs)

    vi.spyOn(fs, 'pathExists').mockImplementation(async (value) => {
      if (value === templatePath || value === templatePackagePath) {
        return true
      }
      return originalPathExists(value as any)
    })
    vi.spyOn(fs, 'readJSON').mockImplementation(async (value) => {
      if (value === templatePackagePath) {
        return { name: 'no-devdeps' }
      }
      return originalReadJSON(value as any)
    })
    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.default)
    const pkgJson = await fs.readJSON(path.join(root, 'package.json'))
    expect(pkgJson.devDependencies).toBeDefined()
    expect(pkgJson.devDependencies['weapp-tailwindcss']).toBe('^4.3.3')
  })

  it('falls back to an empty package.json when template package is missing', async () => {
    const root = await createTmpRoot('no-package')
    const templatePath = path.resolve(import.meta.dirname, '../templates', TemplateName.default)
    const originalPathExists = fs.pathExists.bind(fs)

    vi.spyOn(fs, 'pathExists').mockImplementation(async (value) => {
      if (value === templatePath) {
        return true
      }
      if (value === path.join(templatePath, 'package.json')) {
        return false
      }
      return originalPathExists(value as any)
    })

    await createProject(root, TemplateName.default)
    const pkgJson = await fs.readJSON(path.join(root, 'package.json'))
    expect(pkgJson.name).toBe('weapp-vite-app')
  })

  it('warns when template is missing', async () => {
    const root = await createTmpRoot('missing-template')
    await createProject(root, 'missing' as TemplateName)
    expect(logger.warn).toHaveBeenCalledWith('没有找到 missing 模板!')
    expect(await fs.pathExists(path.join(root, 'package.json'))).toBe(false)
  })

  it('handles ensureDotGitignore branches', async () => {
    const root = await createTmpRoot('ensure-gitignore')
    await createProjectInternal.ensureDotGitignore(root)
    expect(await fs.pathExists(path.join(root, '.gitignore'))).toBe(false)

    await fs.outputFile(path.join(root, 'gitignore'), '# temp')
    await createProjectInternal.ensureDotGitignore(root)
    expect(await fs.pathExists(path.join(root, '.gitignore'))).toBe(true)
    expect(await fs.pathExists(path.join(root, 'gitignore'))).toBe(false)

    await fs.outputFile(path.join(root, 'gitignore'), '# should be removed')
    await fs.outputFile(path.join(root, '.gitignore'), '# existing')
    await createProjectInternal.ensureDotGitignore(root)
    expect(await fs.readFile(path.join(root, '.gitignore'), 'utf8')).toBe('# existing')
    expect(await fs.pathExists(path.join(root, 'gitignore'))).toBe(false)
  })

  it('upserts tailwindcss versions across code paths', async () => {
    const versionSpy = vi.spyOn(npm, 'latestVersion')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('^1.2.3')
    const pkgWithoutDeps: any = {}
    await createProjectInternal.upsertTailwindcssVersion(pkgWithoutDeps)
    expect(pkgWithoutDeps.devDependencies).toBeUndefined()

    const pkgWithFallback = { devDependencies: {} as Record<string, string> }
    await createProjectInternal.upsertTailwindcssVersion(pkgWithFallback)
    expect(pkgWithFallback.devDependencies['weapp-tailwindcss']).toBe('^4.3.3')

    const pkgWithExisting = { devDependencies: { 'weapp-tailwindcss': 'workspace:*' } }
    await createProjectInternal.upsertTailwindcssVersion(pkgWithExisting)
    expect(pkgWithExisting.devDependencies['weapp-tailwindcss']).toBe('workspace:*')

    const pkgWithResolved = { devDependencies: {} as Record<string, string> }
    await createProjectInternal.upsertTailwindcssVersion(pkgWithResolved)
    expect(versionSpy).toHaveBeenCalled()
    expect(pkgWithResolved.devDependencies['weapp-tailwindcss']).toBe('^1.2.3')
  })

  it('updates wevu version when present in dependencies or devDependencies', async () => {
    const root = await createTmpRoot('wevu-version')
    const templatePath = path.resolve(import.meta.dirname, '../templates', TemplateName.default)
    const templatePackagePath = path.join(templatePath, 'package.json')
    const originalReadJSON = fs.readJSON.bind(fs)

    const { version: weappViteVersion } = await fs.readJSON(
      path.resolve(import.meta.dirname, '../../..', 'packages/weapp-vite/package.json'),
    )
    const { version: wevuVersion } = await fs.readJSON(
      path.resolve(import.meta.dirname, '../../..', 'packages/wevu/package.json'),
    )

    vi.spyOn(fs, 'readJSON').mockImplementation(async (value) => {
      if (value === templatePackagePath) {
        return {
          name: 'with-wevu',
          dependencies: {
            wevu: '^0.0.0',
          },
          devDependencies: {
            'wevu': '^0.0.0',
            'weapp-vite': 'workspace:*',
          },
        }
      }
      return originalReadJSON(value as any)
    })
    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.default)

    const pkgJson = await fs.readJSON(path.join(root, 'package.json'))
    expect(pkgJson.devDependencies['weapp-vite']).toBe(`^${weappViteVersion}`)
    expect(pkgJson.dependencies.wevu).toBe(`^${wevuVersion}`)
    expect(pkgJson.devDependencies.wevu).toBe(`^${wevuVersion}`)
  })
})
