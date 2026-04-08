import type { CompilerOptions } from 'typescript'
import type { MutableCompilerContext } from '../context'
import { fs } from '@weapp-core/shared'
import { parse as parseJson } from 'comment-json'
import path from 'pathe'
import { getPlatformAppTypesPackage } from '../platform'
import { resolveBaseDir, WEAPP_VITE_INTERNAL_DIRNAME } from './autoImport/config/base'
import { requireConfigService } from './utils/requireConfigService'

interface ManagedTsconfigFile {
  path: string
  content: string
}

interface ManagedTypeScriptConfig {
  shared?: {
    compilerOptions?: CompilerOptions
    include?: string[]
    exclude?: string[]
    files?: string[]
  }
  app?: {
    compilerOptions?: CompilerOptions
    vueCompilerOptions?: Record<string, any>
    include?: string[]
    exclude?: string[]
    files?: string[]
  }
  node?: {
    compilerOptions?: CompilerOptions
    include?: string[]
    exclude?: string[]
    files?: string[]
  }
  server?: {
    compilerOptions?: CompilerOptions
    include?: string[]
    exclude?: string[]
    files?: string[]
  }
}

interface LegacyManagedTsconfigFile {
  compilerOptions?: CompilerOptions
  include?: string[]
  exclude?: string[]
  files?: string[]
  vueCompilerOptions?: Record<string, any>
}

interface LegacyManagedTypeScriptConfig {
  shared?: LegacyManagedTsconfigFile
  app?: LegacyManagedTsconfigFile
  node?: LegacyManagedTsconfigFile
  server?: LegacyManagedTsconfigFile
}

const DEFAULT_APP_INCLUDE = [
  '../src/**/*',
  '../types/**/*.d.ts',
  '../env.d.ts',
  './**/*.d.ts',
]

const DEFAULT_NODE_INCLUDE = [
  '../vite.config.ts',
  '../vite.config.*.ts',
  '../vite.config.mts',
  '../vite.config.*.mts',
  '../*.config.ts',
  '../*.config.mts',
  '../config/**/*.ts',
  '../config/**/*.mts',
  '../scripts/**/*.ts',
  '../scripts/**/*.mts',
]

const WINDOWS_PATH_SEPARATOR_PATTERN = /\\/g
const LEADING_DOT_SLASH_PATTERN = /^\.\/+/
const TRAILING_SLASH_PATTERN = /\/+$/

function hasDependency(packageJson: Record<string, any> | undefined, name: string) {
  return Boolean(
    packageJson?.dependencies?.[name]
    || packageJson?.devDependencies?.[name]
    || packageJson?.peerDependencies?.[name],
  )
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function rebaseManagedPathValue(root: string, managedDir: string, value: string) {
  if (!value.startsWith('./') && !value.startsWith('../')) {
    return value
  }
  return path.relative(managedDir, path.resolve(root, value)).replace(WINDOWS_PATH_SEPARATOR_PATTERN, '/')
}

function rebaseManagedPaths(root: string, managedDir: string, paths?: Record<string, string[]>) {
  if (!paths) {
    return undefined
  }
  return Object.fromEntries(
    Object.entries(paths).map(([key, values]) => [
      key,
      Array.isArray(values) ? values.map(value => rebaseManagedPathValue(root, managedDir, value)) : [],
    ]),
  )
}

function mergePaths(...entries: Array<Record<string, string[]> | undefined>) {
  const merged: Record<string, string[]> = {}
  for (const entry of entries) {
    if (!entry) {
      continue
    }
    for (const [key, value] of Object.entries(entry)) {
      merged[key] = Array.isArray(value) ? [...value] : []
    }
  }
  return merged
}

function toJson(content: Record<string, any>) {
  return `${JSON.stringify(content, null, 2)}\n`
}

function resolveManagedDir(ctx: MutableCompilerContext) {
  return path.resolve(resolveBaseDir(requireConfigService(ctx, '生成托管 tsconfig 前必须初始化 configService。')), WEAPP_VITE_INTERNAL_DIRNAME)
}

function getManagedTypeScriptConfig(ctx: MutableCompilerContext): ManagedTypeScriptConfig | undefined {
  return requireConfigService(ctx, '读取托管 tsconfig 配置前必须初始化 configService。').weappViteConfig.typescript as ManagedTypeScriptConfig | undefined
}

async function readLegacyManagedTsconfigFile(filePath: string): Promise<LegacyManagedTsconfigFile | undefined> {
  if (!await fs.pathExists(filePath)) {
    return undefined
  }

  try {
    const content = await fs.readFile(filePath, 'utf8')
    const parsed = parseJson(content, undefined, true)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }
    return parsed as LegacyManagedTsconfigFile
  }
  catch {
    return undefined
  }
}

async function getLegacyManagedTypeScriptConfig(ctx: MutableCompilerContext): Promise<LegacyManagedTypeScriptConfig> {
  const root = resolveBaseDir(requireConfigService(ctx, '读取旧 tsconfig 配置前必须初始化 configService。'))
  const [shared, app, node, server] = await Promise.all([
    readLegacyManagedTsconfigFile(path.join(root, 'tsconfig.shared.json')),
    readLegacyManagedTsconfigFile(path.join(root, 'tsconfig.app.json')),
    readLegacyManagedTsconfigFile(path.join(root, 'tsconfig.node.json')),
    readLegacyManagedTsconfigFile(path.join(root, 'tsconfig.server.json')),
  ])

  return {
    shared,
    app,
    node,
    server,
  }
}

function getAppTypes(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
  const configService = requireConfigService(ctx, '生成 app tsconfig 前必须初始化 configService。')
  const packageJson = configService.packageJson
  const config = configService.weappViteConfig
  const userTypes = getManagedTypeScriptConfig(ctx)?.app?.compilerOptions?.types
  const legacyTypes = legacyConfig?.app?.compilerOptions?.types

  const platformAppTypesPackage = getPlatformAppTypesPackage(config.platform)
  const types = [
    platformAppTypesPackage !== 'miniprogram-api-typings' && hasDependency(packageJson, platformAppTypesPackage)
      ? platformAppTypesPackage
      : 'miniprogram-api-typings',
    'weapp-vite/client',
  ]

  if (config.web && config.web.enable !== false) {
    types.push('vite/client')
  }

  if (Array.isArray(legacyTypes) && legacyTypes.length > 0) {
    types.push(...legacyTypes)
  }

  if (Array.isArray(userTypes) && userTypes.length > 0) {
    types.push(...userTypes)
  }

  return unique(types)
}

function getAppPaths(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
  const configService = requireConfigService(ctx, '生成 app paths 前必须初始化 configService。')
  const root = resolveBaseDir(configService)
  const managedDir = resolveManagedDir(ctx)
  const userConfig = getManagedTypeScriptConfig(ctx)
  const normalizedSrcRoot = typeof configService.srcRoot === 'string'
    ? configService.srcRoot
      .replace(WINDOWS_PATH_SEPARATOR_PATTERN, '/')
      .replace(LEADING_DOT_SLASH_PATTERN, '')
      .replace(TRAILING_SLASH_PATTERN, '')
      || 'src'
    : 'src'
  const defaultPaths: Record<string, string[]> = {
    '@/*': [`../${normalizedSrcRoot}/*`],
  }
  if (hasDependency(configService.packageJson, 'wevu')) {
    defaultPaths['weapp-vite/typed-components'] = ['./typed-components.d.ts']
  }
  return mergePaths(
    defaultPaths,
    rebaseManagedPaths(root, managedDir, legacyConfig?.shared?.compilerOptions?.paths as Record<string, string[]> | undefined),
    rebaseManagedPaths(root, managedDir, legacyConfig?.app?.compilerOptions?.paths as Record<string, string[]> | undefined),
    rebaseManagedPaths(root, managedDir, userConfig?.shared?.compilerOptions?.paths as Record<string, string[]> | undefined),
    rebaseManagedPaths(root, managedDir, userConfig?.app?.compilerOptions?.paths as Record<string, string[]> | undefined),
  )
}

function createSharedTsconfig(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
  const userConfig = getManagedTypeScriptConfig(ctx)
  const compilerOptions = {
    target: 'ES2023',
    module: 'ESNext',
    moduleResolution: 'bundler',
    moduleDetection: 'force',
    resolveJsonModule: true,
    allowImportingTsExtensions: true,
    strict: true,
    noFallthroughCasesInSwitch: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noEmit: true,
    verbatimModuleSyntax: true,
    noUncheckedSideEffectImports: true,
    erasableSyntaxOnly: true,
    skipLibCheck: true,
    ...(legacyConfig?.shared?.compilerOptions ?? {}),
    ...(userConfig?.shared?.compilerOptions ?? {}),
  }

  const config = {
    compilerOptions,
  }

  const exclude = unique([
    ...(legacyConfig?.shared?.exclude ?? []),
    ...(userConfig?.shared?.exclude ?? []),
  ])
  const files = unique([
    ...(legacyConfig?.shared?.files ?? []),
    ...(userConfig?.shared?.files ?? []),
  ])
  const include = unique([
    ...(legacyConfig?.shared?.include ?? []),
    ...(userConfig?.shared?.include ?? []),
  ])

  return {
    ...config,
    ...(exclude.length ? { exclude } : {}),
    ...(files.length ? { files } : {}),
    ...(include.length ? { include } : {}),
  }
}

function createAppTsconfig(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
  const userConfig = getManagedTypeScriptConfig(ctx)
  const legacyAppCompilerOptions = legacyConfig?.app?.compilerOptions ?? {}
  const userAppCompilerOptions = userConfig?.app?.compilerOptions ?? {}
  const compilerOptions = {
    tsBuildInfoFile: '../node_modules/.tmp/tsconfig.app.tsbuildinfo',
    target: 'ES2023',
    lib: ['ES2023', 'DOM'],
    jsx: 'preserve',
    resolveJsonModule: true,
    allowJs: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    isolatedModules: true,
    ...legacyAppCompilerOptions,
    ...userAppCompilerOptions,
    types: getAppTypes(ctx, legacyConfig),
    paths: getAppPaths(ctx, legacyConfig),
  }

  const vueCompilerOptions = {
    plugins: ['weapp-vite/volar'],
    ...(hasDependency(requireConfigService(ctx, '生成 Vue tsconfig 前必须初始化 configService。').packageJson, 'wevu') ? { lib: 'wevu' } : {}),
    ...(legacyConfig?.app?.vueCompilerOptions ?? {}),
    ...(userConfig?.app?.vueCompilerOptions ?? {}),
  }

  const include = unique([
    ...DEFAULT_APP_INCLUDE,
    ...(legacyConfig?.app?.include ?? []),
    ...(userConfig?.app?.include ?? []),
  ])
  const exclude = unique([
    ...(legacyConfig?.app?.exclude ?? []),
    ...(userConfig?.app?.exclude ?? []),
  ])
  const files = unique([
    ...(legacyConfig?.app?.files ?? []),
    ...(userConfig?.app?.files ?? []),
  ])

  return {
    extends: './tsconfig.shared.json',
    compilerOptions,
    vueCompilerOptions,
    include,
    ...(exclude.length ? { exclude } : {}),
    ...(files.length ? { files } : {}),
  }
}

function createNodeTsconfig(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
  const userConfig = getManagedTypeScriptConfig(ctx)
  const compilerOptions = {
    tsBuildInfoFile: '../node_modules/.tmp/tsconfig.node.tsbuildinfo',
    target: 'ES2023',
    lib: ['ES2023'],
    types: ['node'],
    ...(legacyConfig?.node?.compilerOptions ?? {}),
    ...(userConfig?.node?.compilerOptions ?? {}),
  }

  const include = unique([
    ...DEFAULT_NODE_INCLUDE,
    ...(legacyConfig?.node?.include ?? []),
    ...(userConfig?.node?.include ?? []),
  ])
  const exclude = unique([
    ...(legacyConfig?.node?.exclude ?? []),
    ...(userConfig?.node?.exclude ?? []),
  ])
  const files = unique([
    ...(legacyConfig?.node?.files ?? []),
    ...(userConfig?.node?.files ?? []),
  ])

  return {
    extends: './tsconfig.shared.json',
    compilerOptions,
    include,
    ...(exclude.length ? { exclude } : {}),
    ...(files.length ? { files } : {}),
  }
}

function createServerTsconfig(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
  const userConfig = getManagedTypeScriptConfig(ctx)
  const compilerOptions = {
    tsBuildInfoFile: '../node_modules/.tmp/tsconfig.server.tsbuildinfo',
    target: 'ES2023',
    lib: ['ES2023'],
    types: ['node'],
    ...(legacyConfig?.server?.compilerOptions ?? {}),
    ...(userConfig?.server?.compilerOptions ?? {}),
  }

  const files = unique([
    ...(legacyConfig?.server?.files ?? []),
    ...(userConfig?.server?.files ?? []),
  ])
  const include = unique([
    ...(legacyConfig?.server?.include ?? []),
    ...(userConfig?.server?.include ?? []),
  ])
  const exclude = unique([
    ...(legacyConfig?.server?.exclude ?? []),
    ...(userConfig?.server?.exclude ?? []),
  ])

  return {
    extends: './tsconfig.shared.json',
    compilerOptions,
    files,
    ...(include.length ? { include } : {}),
    ...(exclude.length ? { exclude } : {}),
  }
}

export async function createManagedTsconfigFiles(ctx: MutableCompilerContext): Promise<ManagedTsconfigFile[]> {
  const managedDir = resolveManagedDir(ctx)
  const legacyConfig = await getLegacyManagedTypeScriptConfig(ctx)
  const sharedPath = path.join(managedDir, 'tsconfig.shared.json')
  const appPath = path.join(managedDir, 'tsconfig.app.json')
  const nodePath = path.join(managedDir, 'tsconfig.node.json')
  const serverPath = path.join(managedDir, 'tsconfig.server.json')

  return [
    {
      path: sharedPath,
      content: toJson(createSharedTsconfig(ctx, legacyConfig)),
    },
    {
      path: appPath,
      content: toJson(createAppTsconfig(ctx, legacyConfig)),
    },
    {
      path: nodePath,
      content: toJson(createNodeTsconfig(ctx, legacyConfig)),
    },
    {
      path: serverPath,
      content: toJson(createServerTsconfig(ctx, legacyConfig)),
    },
  ]
}

async function hasManagedTsconfigChanges(ctx: MutableCompilerContext) {
  const files = await createManagedTsconfigFiles(ctx)

  for (const file of files) {
    const existing = await fs.readFile(file.path, 'utf8').catch(() => undefined)
    if (existing !== file.content) {
      return true
    }
  }

  return false
}

export async function syncManagedTsconfigFiles(ctx: MutableCompilerContext) {
  const changed = await hasManagedTsconfigChanges(ctx)
  for (const file of await createManagedTsconfigFiles(ctx)) {
    await fs.outputFile(file.path, file.content, 'utf8')
  }
  return changed
}

export async function syncManagedTsconfigBootstrapFiles(cwd: string) {
  const packageJsonPath = path.resolve(cwd, 'package.json')
  const packageJson = await fs.readJson(packageJsonPath, { throws: false }).catch(() => undefined) ?? {}
  const bootstrapCtx = {
    configService: {
      cwd,
      configFilePath: undefined,
      packageJson,
      weappViteConfig: {},
    },
  } as MutableCompilerContext

  let changed = false
  for (const file of await createManagedTsconfigFiles(bootstrapCtx)) {
    const existing = await fs.readFile(file.path, 'utf8').catch(() => undefined)
    if (existing != null) {
      continue
    }
    await fs.outputFile(file.path, file.content, 'utf8')
    changed = true
  }

  return changed
}
