/* eslint-disable ts/no-use-before-define */
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import vantComponents from '../../src/auto-import-components/resolvers/json/vant.json'
import { resolveRepoRoot, resolveWorkspaceNodeModulesDir } from '../../src/utils/workspace'
import { writeBenchmarkResolverFile } from '../utils/benchmark-tsconfig'
import { patchProjectConfigFile } from '../utils/config-file'

const scriptRoot = path.resolve(import.meta.dirname, '..')
const fixtureSource = path.resolve(scriptRoot, '../../../test/fixture-projects/weapp-vite/auto-import')
const resolvedNodeModulesDir = resolveWorkspaceNodeModulesDir(scriptRoot)
const resolvedRootDir = resolveRepoRoot(scriptRoot)
if (!resolvedNodeModulesDir || !resolvedRootDir) {
  throw new Error('Unable to locate the benchmark workspace.')
}
export const workspaceRootNodeModulesDir = resolvedNodeModulesDir
export const workspaceRootDir = resolvedRootDir
const workspaceWeappViteDir = path.resolve(scriptRoot, '..')
export const cliPath = path.join(workspaceWeappViteDir, 'bin/weapp-vite.js')
const resolverComponents = createVantResolverComponents()
export const allResolverTags = Object.keys(resolverComponents).sort((a, b) => a.localeCompare(b))
const DEFINE_CONFIG_IMPORT = pathToFileURL(path.join(workspaceWeappViteDir, 'src/config.ts')).href
const BENCHMARK_RESOLVER_PATH = './benchmark-vant-resolver'
const VANT_PACKAGE_PREFIX_RE = /^@vant\/weapp\/?/
const ORIGINAL_AUTO_IMPORT_BLOCK = [
  '      autoImportComponents: {',
  '        globs: [\'components/**/*\'],',
  '        resolvers: [',
  '          VantResolver()',
  '        ]',
  '      }',
].join('\n')

export async function seedFixture(projectRoot: string, usedTags: string[], disableCurrentSupportOutputs: boolean, mode: 'baseline' | 'current') {
  const pageDir = path.join(projectRoot, 'src/pages/bench-hmr-auto-import')
  const pagePath = path.join(pageDir, 'index.vue')
  const appJsonPath = path.join(projectRoot, 'src/app.json')
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const tags = usedTags
    .map(tag => `    <${tag} data-bench="${tag}" />`)
    .join('\n')
  const source = [
    '<template>',
    '  <view class="bench-hmr-auto-import">',
    tags,
    '  </view>',
    '</template>',
    '',
    '<json>',
    JSON.stringify({
      navigationBarTitleText: 'Auto Import HMR Bench',
      ...(mode === 'baseline' ? { usingComponents: createUsingComponentsMap(usedTags) } : {}),
    }, null, 2),
    '</json>',
    '',
  ].join('\n')

  await ensureProjectConfigFiles(projectRoot)
  await patchBenchmarkConfigImports(projectRoot)
  await patchViteConfig(projectRoot, mode, disableCurrentSupportOutputs)
  await ensureBenchmarkResolverPackage(projectRoot, usedTags)
  await mkdir(pageDir, { recursive: true })
  await writeFile(pagePath, source, 'utf8')

  const appJson = JSON.parse(await readFile(appJsonPath, 'utf8')) as { pages?: string[] }
  appJson.pages = ['pages/bench-hmr-auto-import/index']
  await writeFile(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, 'utf8')

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  packageJson.dependencies = {
    ...(packageJson.dependencies ?? {}),
    '@vant/weapp': '1.0.0-benchmark',
  }
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')

  return source
}

async function patchViteConfig(projectRoot: string, mode: 'baseline' | 'current', disableCurrentSupportOutputs: boolean) {
  const replacement = mode === 'baseline'
    ? '      autoImportComponents: false,'
    : [
        '      autoImportComponents: {',
        ...(disableCurrentSupportOutputs
          ? [
              '        output: false,',
              '        typedComponents: false,',
              '        htmlCustomData: false,',
              '        vueComponents: false,',
            ]
          : []),
        '        resolvers: [',
        '          VantResolver()',
        '        ]',
        '      }',
      ].join('\n')
  await patchProjectConfigFile(
    projectRoot,
    content => content.replace(ORIGINAL_AUTO_IMPORT_BLOCK, replacement),
    {
      errorMessage: 'Failed to patch benchmark config for hmr benchmark',
    },
  )
}

async function patchBenchmarkConfigImports(projectRoot: string) {
  await patchProjectConfigFile(
    projectRoot,
    content => content
      .replace(`import { defineConfig } from 'weapp-vite'`, `import { defineConfig } from '${DEFINE_CONFIG_IMPORT}'`)
      .replace(`import { VantResolver } from 'weapp-vite/auto-import-components/resolvers'`, `import { VantResolver } from '${BENCHMARK_RESOLVER_PATH}'`),
    {
      allowUnchanged: true,
      errorMessage: 'Failed to patch benchmark config imports for hmr benchmark',
    },
  )

  await writeBenchmarkResolverFile(projectRoot, renderBenchmarkVantResolver())
}

async function ensureProjectConfigFiles(projectRoot: string) {
  for (const fileName of ['project.config.json', 'project.private.config.json']) {
    const sourcePath = path.join(fixtureSource, fileName)
    const targetPath = path.join(projectRoot, fileName)
    const content = await readFile(sourcePath, 'utf8')
    await writeFile(targetPath, content, 'utf8')
  }
}

function createUsingComponentsMap(usedTags: string[]) {
  return Object.fromEntries(
    usedTags.map((tag) => {
      const from = resolverComponents[tag]
      if (!from) {
        throw new Error(`Missing resolver mapping for benchmark tag: ${tag}`)
      }
      return [tag, from]
    }),
  )
}

async function ensureBenchmarkResolverPackage(projectRoot: string, usedTags: string[]) {
  const tempRoot = path.dirname(projectRoot)
  const packageRoot = path.join(tempRoot, 'node_modules/@vant/weapp')
  await mkdir(packageRoot, { recursive: true })
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: '@vant/weapp',
    version: '1.0.0-benchmark',
  }, null, 2))

  for (const tag of usedTags) {
    const from = resolverComponents[tag]
    if (!from) {
      throw new Error(`Missing resolver mapping for benchmark tag: ${tag}`)
    }
    const relativeEntry = from.replace(VANT_PACKAGE_PREFIX_RE, '')
    const componentDir = path.join(packageRoot, relativeEntry)
    await mkdir(componentDir, { recursive: true })
    await writeFile(path.join(componentDir, 'index.json'), `${JSON.stringify({ component: true }, null, 2)}\n`, 'utf8')
    await writeFile(path.join(componentDir, 'index.js'), 'Component({})\n', 'utf8')
    await writeFile(path.join(componentDir, 'index.wxml'), `<view data-bench="${tag}">${tag}</view>\n`, 'utf8')
    await writeFile(path.join(componentDir, 'index.wxss'), '', 'utf8')
  }
}

export async function createTempFixtureProject(prefix: string) {
  const sourceRoot = fixtureSource
  const tempRoot = path.resolve(sourceRoot, '..', '__temp__')
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, `${prefix}-`))
  const ignored = new Set(['.weapp-vite', 'dist', 'node_modules'])

  await cp(sourceRoot, tempDir, {
    dereference: true,
    force: true,
    recursive: true,
    filter: (src) => {
      const relative = path.relative(sourceRoot, src).replaceAll('\\', '/')
      if (!relative) {
        return true
      }
      return !Array.from(ignored).some(entry => relative === entry || relative.startsWith(`${entry}/`))
    },
  })

  await linkWorkspaceNodeModules(tempDir)

  return {
    tempDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
      await rm(path.join(tempRoot, 'node_modules'), { recursive: true, force: true })
      const remaining = await readdir(tempRoot).catch(() => null)
      if (remaining && remaining.length === 0) {
        await rm(tempRoot, { recursive: true, force: true })
      }
    },
  }
}

async function linkWorkspaceNodeModules(projectRoot: string) {
  const projectNodeModulesDir = path.join(projectRoot, 'node_modules')
  const existingNodeModules = await lstat(projectNodeModulesDir).catch(() => null)
  if (existingNodeModules) {
    await rm(projectNodeModulesDir, { recursive: true, force: true })
  }
  await symlink(path.relative(projectRoot, workspaceRootNodeModulesDir), projectNodeModulesDir, 'junction')

  const packageRoot = path.join(projectNodeModulesDir, 'weapp-vite')
  const existingPackage = await lstat(packageRoot).catch(() => null)
  if (existingPackage?.isSymbolicLink()) {
    const currentTarget = await readlink(packageRoot).catch(() => '')
    if (path.resolve(projectNodeModulesDir, currentTarget) === workspaceWeappViteDir) {
      return
    }
  }
  if (existingPackage) {
    await rm(packageRoot, { recursive: true, force: true })
  }
  await symlink(path.relative(projectNodeModulesDir, workspaceWeappViteDir), packageRoot, 'junction')
}

function createVantResolverComponents() {
  return Object.fromEntries(vantComponents.map(component => [toVantTag(component), `@vant/weapp/${component}`]))
}

function toVantTag(component: string) {
  return `van-${component}`
}

function renderBenchmarkVantResolver() {
  return [
    `const components = Object.freeze(${JSON.stringify(resolverComponents, null, 2)} as const)`,
    '',
    'export function VantResolver() {',
    '  return {',
    '    components,',
    '    supportFilesStrategy: \'full\',',
    '    resolve(componentName: string) {',
    '      const from = components[componentName as keyof typeof components]',
    '      if (!from) {',
    '        return undefined',
    '      }',
    '      return { name: componentName, from }',
    '    },',
    '  }',
    '}',
    '',
  ].join('\n')
}
