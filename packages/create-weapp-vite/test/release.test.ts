import { realpath } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
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

interface PackResult {
  filename: string
  files: Array<{ path: string }>
}

async function readPackageManifest(filePath: string): Promise<PackageManifest> {
  return await fs.readJSON(filePath) as PackageManifest
}

async function linkNodeModuleEntry(source: string, destination: string, entry: import('node:fs').Dirent) {
  if (entry.isSymbolicLink()) {
    await fs.symlink(await realpath(source), destination, process.platform === 'win32' ? 'junction' : 'dir')
    return
  }
  await fs.copy(source, destination, { dereference: true })
}

async function materializeNodeModules(source: string, destination: string) {
  await fs.ensureDir(destination)
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      await fs.ensureDir(destinationPath)
      for (const scopedEntry of await fs.readdir(sourcePath, { withFileTypes: true })) {
        await linkNodeModuleEntry(
          path.join(sourcePath, scopedEntry.name),
          path.join(destinationPath, scopedEntry.name),
          scopedEntry,
        )
      }
      continue
    }
    await linkNodeModuleEntry(sourcePath, destinationPath, entry)
  }
}

function parsePackJson(stdout: string) {
  // prepack 构建日志位于 JSON 之前；兼容 pnpm 的对象与数组结果格式。
  const jsonText = stdout.match(/(?:^|\r?\n)(\{[\s\S]*\}|\[\s*\{[\s\S]*\}\s*\])\s*$/)?.[1]
  if (!jsonText) {
    throw new Error('pnpm pack --json 未返回有效输出')
  }
  const parsed = JSON.parse(jsonText) as PackResult | PackResult[]
  const result = Array.isArray(parsed) ? parsed[0] : parsed
  if (!result?.filename || !Array.isArray(result.files)) {
    throw new Error('pnpm pack 未返回 tarball 文件名或文件清单')
  }
  return result
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
  // A junction of the whole workspace `node_modules` leaves pnpm's relative
  // links rooted at the extracted tarball on Windows. Link each direct package
  // to its real pnpm store location instead, preserving transitive resolution
  // through the store's sibling `node_modules` directory on every platform.
  await materializeNodeModules(path.join(packageRoot, 'node_modules'), path.join(packedPackageRoot, 'node_modules'))
  const networkGuard = path.join(tempRoot, 'deny-network.mjs')
  await fs.writeFile(networkGuard, `import net from 'node:net'
net.Socket.prototype.connect = () => { throw new Error('Default scaffolding must not access the network') }
`)

  // 安装目录中不存在源码仓库的模板回退路径，必须使用 tarball 自带模板。
  expect(await fs.pathExists(path.resolve(packedPackageRoot, '../../templates'))).toBe(false)
  for (const templateName of Object.values(TemplateName)) {
    const projectName = `packed-${templateName}`
    await execa(process.execPath, [
      path.join(packedPackageRoot, 'bin/create-weapp-vite.js'),
      projectName,
      templateName,
      '--no-install-skills',
    ], {
      cwd: projectsRoot,
      env: { CI: 'true', NODE_OPTIONS: `--import=${pathToFileURL(networkGuard).href}` },
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
    if (dependencies.wevu) {
      expect(dependencies.wevu).toBe(dependencies['weapp-vite'])
    }
    if (dependencies['@weapp-vite/dashboard']) {
      expect(dependencies['@weapp-vite/dashboard']).toBe(dependencies['weapp-vite'])
    }
    expect(await fs.pathExists(path.join(projectRoot, 'src'))).toBe(true)
    expect(await fs.pathExists(path.join(projectRoot, '.gitignore'))).toBe(true)
    expect(await fs.pathExists(path.join(projectRoot, 'AGENTS.md'))).toBe(true)
    expect(await fs.pathExists(path.join(projectRoot, 'pnpm-workspace.yaml'))).toBe(true)
  }
}

describe('create-weapp-vite release pack', () => {
  it('ships complete templates and creates projects with the bundled release versions from its tarball', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const workspaceTemplateRoot = path.resolve(packageRoot, '../../templates/weapp-vite-plugin-template')
    const generatedTemplateFile = path.join(workspaceTemplateRoot, 'dist-plugin', 'pack-sentinel.js')
    const generatedTemplateDirExisted = await fs.pathExists(path.dirname(generatedTemplateFile))
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-pack-'))
    const packedModulesRoot = path.join(tempRoot, 'installed', 'node_modules')

    try {
      await fs.outputFile(generatedTemplateFile, 'generated')

      const { stdout } = await execa(
        'pnpm',
        ['pack', '--json', '--config.ignore-scripts=false', '--pack-destination', tempRoot],
        {
          cwd: packageRoot,
          env: {
            ...process.env,
            npm_config_loglevel: 'silent',
          },
        },
      )
      const packResult = parsePackJson(stdout)
      const packedFiles = new Set(packResult.files.map(file => file.path))

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
      // GNU tar on Windows interprets an absolute `C:\...` archive path as a
      // remote host. Use paths relative to the temporary root for portability.
      const archivePath = path.resolve(tempRoot, packResult.filename)
      const archiveRelativePath = path.relative(tempRoot, archivePath).replaceAll(path.sep, '/')
      const modulesRelativePath = path.relative(tempRoot, packedModulesRoot).replaceAll(path.sep, '/')
      await execa('tar', ['-xzf', archiveRelativePath, '-C', modulesRelativePath], { cwd: tempRoot })
      const packedPackageRoot = path.join(packedModulesRoot, 'create-weapp-vite')
      await fs.move(path.join(packedModulesRoot, 'package'), packedPackageRoot)
      const packedManifest = await readPackageManifest(path.join(packedPackageRoot, 'package.json'))
      expect(Object.keys(packedManifest.dependencies ?? {})).not.toHaveLength(0)
      for (const field of dependencyFields) {
        for (const [name, spec] of Object.entries(packedManifest[field] ?? {})) {
          expect(spec, `packed package.json: ${field}.${name}`).not.toMatch(/^(?:workspace|catalog):/)
        }
      }
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
