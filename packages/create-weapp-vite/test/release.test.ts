import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fs } from '@weapp-core/shared/fs'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { TemplateName } from '@/enums'

const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const
const bundledPackagePaths = {
  'weapp-vite': 'packages/weapp-vite/package.json',
  'wevu': 'packages-runtime/wevu/package.json',
  '@weapp-vite/react': 'packages-runtime/react/package.json',
  '@weapp-vite/dashboard': 'packages/dashboard/package.json',
  '@weapp-vite/eslint': 'packages/eslint/package.json',
}

interface PackageManifest {
  version: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

async function readPackageManifest(filePath: string): Promise<PackageManifest> {
  return await fs.readJSON(filePath) as PackageManifest
}

function parsePackJson(stdout: string) {
  const jsonText = stdout.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/)?.[0]
  if (!jsonText) {
    throw new Error('npm pack --json 未返回任何输出')
  }
  return JSON.parse(jsonText) as Array<{
    filename: string
    files?: Array<{ path: string }>
  }>
}

async function assertBundledCliVersions(packageRoot: string, packedPackageRoot: string, tempRoot: string) {
  const repoRoot = path.resolve(packageRoot, '../..')
  const bundledVersions = Object.fromEntries(await Promise.all(
    Object.entries(bundledPackagePaths).map(async ([name, manifestPath]) => {
      const manifest = await readPackageManifest(path.join(repoRoot, manifestPath))
      return [name, `^${manifest.version}`]
    }),
  ))
  const projectsRoot = path.join(tempRoot, 'projects')
  await fs.ensureDir(projectsRoot)
  await fs.symlink(path.join(packageRoot, 'node_modules'), path.join(packedPackageRoot, 'node_modules'), 'junction')

  // 安装目录中不存在源码仓库的模板回退路径，必须使用 tarball 自带模板。
  expect(await fs.pathExists(path.resolve(packedPackageRoot, '../../templates'))).toBe(false)
  for (const templateName of [TemplateName.default, TemplateName.wevu, TemplateName.react]) {
    const projectName = `packed-${templateName}`
    await execa(process.execPath, [
      path.join(packedPackageRoot, 'bin/create-weapp-vite.js'),
      projectName,
      templateName,
      '--dependency-versions=bundled',
      '--no-install-skills',
    ], {
      cwd: projectsRoot,
      env: { CI: 'true' },
      timeout: 15_000,
    })

    const projectRoot = path.join(projectsRoot, projectName)
    const generated = await readPackageManifest(path.join(projectRoot, 'package.json'))
    const template = await readPackageManifest(path.join(packedPackageRoot, 'templates', templateName, 'package.json'))
    for (const field of dependencyFields) {
      for (const [name, expectedVersion] of Object.entries(bundledVersions)) {
        if (template[field]?.[name]) {
          expect(generated[field]?.[name], `${templateName}: ${field}.${name}`).toBe(expectedVersion)
        }
        else {
          expect(generated[field]?.[name], `${templateName}: ${field}.${name}`).toBeUndefined()
        }
      }
      for (const [name, spec] of Object.entries(generated[field] ?? {})) {
        expect(spec, `${templateName}: ${field}.${name}`).not.toMatch(/^(?:workspace|catalog):/)
      }
    }

    const dependencies = { ...generated.dependencies, ...generated.devDependencies }
    expect(dependencies.wevu).toBe(dependencies['weapp-vite'])
    if (dependencies['@weapp-vite/dashboard']) {
      expect(dependencies['@weapp-vite/dashboard']).toBe(dependencies['weapp-vite'])
    }
    expect(await fs.pathExists(path.join(projectRoot, 'src'))).toBe(true)
    expect(await fs.pathExists(path.join(projectRoot, '.gitignore'))).toBe(true)
    expect(await fs.pathExists(path.join(projectRoot, 'AGENTS.md'))).toBe(true)
  }
}

describe('create-weapp-vite release pack', () => {
  it('ships complete templates and creates projects with the bundled release versions from its tarball', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const workspaceTemplateRoot = path.resolve(packageRoot, '../../templates/weapp-vite-plugin-template')
    const generatedTemplateFile = path.join(workspaceTemplateRoot, 'dist-plugin', 'pack-sentinel.js')
    const generatedTemplateDirExisted = await fs.pathExists(path.dirname(generatedTemplateFile))
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-pack-'))
    const cacheDir = path.join(tempRoot, 'cache')
    const packedModulesRoot = path.join(tempRoot, 'installed', 'node_modules')

    try {
      await fs.outputFile(generatedTemplateFile, 'generated')

      const { stdout } = await execa(
        'npm',
        ['pack', '--json', '.', '--ignore-scripts=false', '--dry-run=false', '--pack-destination', tempRoot, '--cache', cacheDir],
        {
          cwd: packageRoot,
          env: {
            ...process.env,
            npm_config_loglevel: 'silent',
          },
        },
      )
      const [packResult] = parsePackJson(stdout)
      if (!packResult?.filename) {
        throw new Error('npm pack 未返回 tarball 文件名')
      }
      const packedFiles = new Set((packResult?.files ?? []).map(file => file.path))

      expect(packedFiles.has('bin/create-weapp-vite.js')).toBe(true)
      expect(packedFiles.has('dist/cli.js')).toBe(true)
      expect(packedFiles.has('dist/index.js')).toBe(true)

      for (const templateName of Object.values(TemplateName)) {
        expect(packedFiles.has(`templates/${templateName}/package.json`)).toBe(true)
      }

      expect(packedFiles.has('templates/default/project.config.json')).toBe(true)
      expect(packedFiles.has('templates/multi-platform/config/weapp/project.config.json')).toBe(true)
      for (const configPath of [
        'config/alipay/mini.project.json',
        'config/jd/project.config.json',
        'config/swan/project.swan.json',
        'config/tt/project.config.json',
        'config/weapp/project.config.json',
        'config/xhs/project.config.json',
      ]) {
        expect(packedFiles.has(`templates/multi-platform-sfc/${configPath}`)).toBe(true)
      }
      expect(packedFiles.has('templates/multi-platform-sfc/src/app.vue')).toBe(true)
      expect(packedFiles.has('templates/multi-platform-sfc/src/pages/index/index.vue')).toBe(true)
      expect(packedFiles.has('templates/multi-platform-sfc/src/components/PlatformCard/index.vue')).toBe(true)
      expect([...packedFiles].some(file => file.startsWith('templates/plugin/dist-'))).toBe(false)

      await fs.ensureDir(packedModulesRoot)
      await execa('tar', ['-xzf', path.join(tempRoot, packResult.filename), '-C', packedModulesRoot])
      const packedPackageRoot = path.join(packedModulesRoot, 'create-weapp-vite')
      await fs.move(path.join(packedModulesRoot, 'package'), packedPackageRoot)
      await assertBundledCliVersions(packageRoot, packedPackageRoot, tempRoot)
    }
    finally {
      await fs.remove(generatedTemplateFile)
      if (!generatedTemplateDirExisted) {
        await fs.remove(path.dirname(generatedTemplateFile))
      }
      await fs.remove(tempRoot)
    }
  }, 120_000)
})
