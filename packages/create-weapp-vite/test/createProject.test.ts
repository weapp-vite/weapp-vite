import os from 'node:os'
// eslint-disable-next-line e18e/ban-dependencies
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, vi } from 'vitest'
import { __internal as createProjectInternal } from '@/createProject'
import { TemplateName } from '@/enums'
import { TEMPLATE_CATALOG, TEMPLATE_NAMED_CATALOG } from '@/generated/catalog'
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

async function getTemplatePackagePath(templateName: TemplateName) {
  const { preferredTemplateDir, workspaceTemplateDir } = await createProjectInternal.resolveTemplateDirs(templateName)
  const templateDir = await fs.pathExists(preferredTemplateDir)
    ? preferredTemplateDir
    : workspaceTemplateDir

  return path.join(templateDir, 'package.json')
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
    expect(TEMPLATE_CATALOG.vite).toBe('8.0.2')
    expect(TEMPLATE_CATALOG.rolldown).toBe('1.0.0-rc.11')
    expect(await fs.pathExists(path.join(root, '.gitignore'))).toBe(true)
    expect(await fs.pathExists(path.join(root, 'gitignore'))).toBe(false)
    const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8')
    expect(gitignore).toContain('node_modules')
    expect(gitignore).toContain('.weapp-vite/')
    expect(await fs.pathExists(path.join(root, 'AGENTS.md'))).toBe(true)
    const agents = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8')
    expect(agents).toContain('weapp-vite screenshot')
    expect(agents).toContain('wv screenshot')
    expect(agents).toContain('node_modules/weapp-vite/dist/docs/')
    expect(agents).toContain('npx skills add sonofmagic/skills')
    expect(agents).toContain('$weapp-vite-best-practices')

    const files = await scanFiles(root)
    expect(files).toContain('package.json')
    expect(files).toContain('AGENTS.md')
  })

  it('writes richer wevu-specific AGENTS guidance for wevu templates', async () => {
    const root = await createTmpRoot('wevu-agents')

    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.wevu)

    const agents = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8')
    expect(agents).toContain('$wevu-best-practices')
    expect(agents).toContain('Import runtime APIs from `wevu`')
    expect(agents).toContain('storeToRefs')
    expect(agents).not.toContain('## Native Mini-program Authoring')
  })

  it('preserves existing .gitignore when templates ship gitignore', async () => {
    const root = await createTmpRoot('existing-ignore')
    await fs.outputFile(path.join(root, '.gitignore'), '# existing entry\n')

    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.tailwindcss)

    const pkgJson = await fs.readJSON(path.join(root, 'package.json'))
    expect(pkgJson.devDependencies['weapp-tailwindcss']).toBe(TEMPLATE_CATALOG['weapp-tailwindcss'])
    const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8')
    expect(gitignore).toContain('# existing entry')
    expect(gitignore).toContain('dist-web')
    expect(gitignore).toContain('dist-plugin')
    expect(gitignore).toContain('.weapp-vite/')
    expect(gitignore.split('\n').filter(line => line === '.weapp-vite/')).toHaveLength(1)
    expect(gitignore.split('\n').filter(line => line === 'node_modules')).toHaveLength(1)
    expect(await fs.pathExists(path.join(root, 'gitignore'))).toBe(false)
  })

  it('initializes devDependencies when template package misses the field', async () => {
    const root = await createTmpRoot('no-devdeps')
    const { preferredTemplateDir: templatePath } = await createProjectInternal.resolveTemplateDirs(TemplateName.default)
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
    const { preferredTemplateDir: templatePath } = await createProjectInternal.resolveTemplateDirs(TemplateName.default)
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

  it('copies nested template files when the template source lives under node_modules', async () => {
    const sourceRoot = await createTmpRoot('installed-template-source')
    const targetRoot = await createTmpRoot('installed-template-target')
    const fakeInstalledTemplateRoot = path.join(
      sourceRoot,
      'node_modules',
      'create-weapp-vite',
      'templates',
      TemplateName.default,
    )
    const { preferredTemplateDir } = await createProjectInternal.resolveTemplateDirs(TemplateName.default)

    await fs.copy(preferredTemplateDir, fakeInstalledTemplateRoot)
    await createProjectInternal.copyTemplateDir(fakeInstalledTemplateRoot, fakeInstalledTemplateRoot, targetRoot)

    const files = await scanFiles(targetRoot)
    expect(files).toContain('src/app.json')
    expect(files).toContain('public/logo.png')
    expect(files).toContain('project.config.json')
  })

  it('does not treat the installed package path itself as a nested template node_modules directory', () => {
    const fakeInstalledTemplateRoot = path.join(
      '/tmp',
      'node_modules',
      'create-weapp-vite',
      'templates',
      TemplateName.default,
    )

    expect(
      createProjectInternal.shouldSkipTemplateFile(
        path.join(fakeInstalledTemplateRoot, 'src', 'app.json'),
        fakeInstalledTemplateRoot,
      ),
    ).toBe(false)
    expect(
      createProjectInternal.shouldSkipTemplateFile(
        path.join(fakeInstalledTemplateRoot, 'node_modules', 'foo', 'index.js'),
        fakeInstalledTemplateRoot,
      ),
    ).toBe(true)
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

  it('updates wevu version when present in dependencies, devDependencies or peerDependencies', async () => {
    const root = await createTmpRoot('wevu-version')
    const templatePackagePath = await getTemplatePackagePath(TemplateName.default)
    const originalReadJSON = fs.readJSON.bind(fs)

    const { version: weappViteVersion } = await fs.readJSON(
      path.resolve(import.meta.dirname, '../../..', 'packages/weapp-vite/package.json'),
    )
    const { version: wevuVersion } = await fs.readJSON(
      path.resolve(import.meta.dirname, '../../..', 'packages-runtime/wevu/package.json'),
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
          peerDependencies: {
            wevu: 'workspace:*',
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
    expect(pkgJson.peerDependencies.wevu).toBe(`^${wevuVersion}`)
  })

  it('resolves catalog dependency placeholders from template package', async () => {
    const root = await createTmpRoot('catalog-specs')
    const templatePackagePath = await getTemplatePackagePath(TemplateName.default)
    const originalReadJSON = fs.readJSON.bind(fs)

    vi.spyOn(fs, 'readJSON').mockImplementation(async (value) => {
      if (value === templatePackagePath) {
        return {
          name: 'catalog-specs',
          dependencies: {
            '@vant/weapp': 'catalog:',
            'tdesign-miniprogram': 'catalog:tdesign-miniprogram-fixed',
          },
          devDependencies: {
            'tailwindcss': 'catalog:tailwind4',
            'typescript': 'catalog:latest',
            'miniprogram-api-typings': 'catalog:',
            'postcss': 'workspace:^8.5.6',
            'sass': 'workspace:*',
            'weapp-vite': 'workspace:*',
          },
        }
      }
      return originalReadJSON(value as any)
    })
    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.default)
    const pkgJson = await fs.readJSON(path.join(root, 'package.json'))

    expect(pkgJson.dependencies['@vant/weapp']).toBe(TEMPLATE_CATALOG['@vant/weapp'])
    expect(pkgJson.dependencies['tdesign-miniprogram']).toBe(
      TEMPLATE_NAMED_CATALOG['tdesign-miniprogram-fixed']['tdesign-miniprogram'],
    )
    expect(pkgJson.devDependencies['tailwindcss']).toBe(TEMPLATE_NAMED_CATALOG.tailwind4.tailwindcss)
    expect(pkgJson.devDependencies['typescript']).toBe(TEMPLATE_CATALOG.typescript)
    expect(pkgJson.devDependencies['miniprogram-api-typings']).toBe(TEMPLATE_CATALOG['miniprogram-api-typings'])
    expect(pkgJson.devDependencies['postcss']).toBe('^8.5.6')
    expect(pkgJson.devDependencies['sass']).toBe('^1.98.0')
    expect(pkgJson.devDependencies['weapp-vite']).not.toContain('workspace:')
    expect(pkgJson.devDependencies['weapp-vite']).not.toContain('catalog:')
  })

  it('resolves workspace specs in peerDependencies and optionalDependencies from template package', async () => {
    const root = await createTmpRoot('workspace-peer-optional-specs')
    const templatePackagePath = await getTemplatePackagePath(TemplateName.lib)
    const originalReadJSON = fs.readJSON.bind(fs)

    vi.spyOn(fs, 'readJSON').mockImplementation(async (value) => {
      if (value === templatePackagePath) {
        return {
          name: 'workspace-peer-optional-specs',
          peerDependencies: {
            wevu: 'workspace:*',
            vue: 'workspace:^3.5.13',
          },
          optionalDependencies: {
            sass: 'workspace:*',
          },
          devDependencies: {
            'weapp-vite': 'workspace:*',
          },
        }
      }
      return originalReadJSON(value as any)
    })
    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.lib)
    const pkgJson = await fs.readJSON(path.join(root, 'package.json'))

    expect(pkgJson.peerDependencies.wevu).not.toContain('workspace:')
    expect(pkgJson.peerDependencies.wevu).not.toContain('catalog:')
    expect(pkgJson.peerDependencies.vue).toBe('^3.5.13')
    expect(pkgJson.optionalDependencies.sass).toBe('^1.98.0')
    expect(pkgJson.devDependencies['weapp-vite']).not.toContain('workspace:')
  })

  it('keeps tailwind templates pinned to the named tailwind3 catalog when creating projects', async () => {
    const root = await createTmpRoot('tailwind3-template')
    const templatePackagePath = await getTemplatePackagePath(TemplateName.tailwindcss)
    const originalReadJSON = fs.readJSON.bind(fs)

    vi.spyOn(fs, 'readJSON').mockImplementation(async (value) => {
      if (value === templatePackagePath) {
        return {
          name: 'tailwind3-template',
          devDependencies: {
            'tailwindcss': 'catalog:tailwind3',
            'weapp-vite': 'workspace:*',
          },
        }
      }
      return originalReadJSON(value as any)
    })
    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.tailwindcss)

    const pkgJson = await fs.readJSON(path.join(root, 'package.json'))
    expect(pkgJson.devDependencies['tailwindcss']).toBe(TEMPLATE_NAMED_CATALOG.tailwind3.tailwindcss)
  })

  it('creates wevu template with layout scaffold files', async () => {
    const root = await createTmpRoot('wevu-layouts')

    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.wevu)

    const files = await scanFiles(root)
    expect(files).toContain('src/layouts/default.vue')
    expect(files).toContain('src/layouts/admin.vue')
    expect(files).toContain('src/pages/layouts/index.vue')
  })

  it('creates lib template with native layout scaffold files', async () => {
    const root = await createTmpRoot('lib-layouts')

    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, TemplateName.lib)

    const files = await scanFiles(root)
    expect(files).toContain('src/layouts/default/index.wxml')
    expect(files).toContain('src/layouts/admin/index.wxml')
    expect(files).toContain('src/pages/layouts/index.ts')
    expect(files).toContain('src/pages/layouts/index.wxml')
  })
})
