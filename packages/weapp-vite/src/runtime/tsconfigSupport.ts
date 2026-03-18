import type { CompilerOptions } from 'typescript'
import type { MutableCompilerContext } from '../context'
import fs from 'fs-extra'
import path from 'pathe'
import { resolveBaseDir, WEAPP_VITE_INTERNAL_DIRNAME } from './autoImport/config/base'

interface ManagedTsconfigFile {
  path: string
  content: string
}

interface ManagedTypeScriptConfig {
  shared?: {
    compilerOptions?: CompilerOptions
  }
  app?: {
    compilerOptions?: CompilerOptions
    vueCompilerOptions?: Record<string, any>
    include?: string[]
  }
  node?: {
    compilerOptions?: CompilerOptions
    include?: string[]
  }
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
  return path.resolve(resolveBaseDir(ctx.configService), WEAPP_VITE_INTERNAL_DIRNAME)
}

function getManagedTypeScriptConfig(ctx: MutableCompilerContext): ManagedTypeScriptConfig | undefined {
  return ctx.configService.weappViteConfig.typescript as ManagedTypeScriptConfig | undefined
}

function getAppTypes(ctx: MutableCompilerContext) {
  const packageJson = ctx.configService.packageJson
  const config = ctx.configService.weappViteConfig
  const userTypes = getManagedTypeScriptConfig(ctx)?.app?.compilerOptions?.types
  if (Array.isArray(userTypes) && userTypes.length > 0) {
    return [...userTypes]
  }

  const types = [
    config.platform === 'alipay' && hasDependency(packageJson, '@mini-types/alipay')
      ? '@mini-types/alipay'
      : 'miniprogram-api-typings',
  ]

  if (config.web?.enabled) {
    types.push('vite/client')
  }

  return unique(types)
}

function getAppPaths(ctx: MutableCompilerContext) {
  const userConfig = getManagedTypeScriptConfig(ctx)
  const defaultPaths: Record<string, string[]> = {
    '@/*': ['src/*'],
  }
  if (hasDependency(ctx.configService.packageJson, 'wevu')) {
    defaultPaths['weapp-vite/typed-components'] = ['.weapp-vite/typed-components.d.ts']
  }
  return mergePaths(
    defaultPaths,
    userConfig?.shared?.compilerOptions?.paths as Record<string, string[]> | undefined,
    userConfig?.app?.compilerOptions?.paths as Record<string, string[]> | undefined,
  )
}

function createSharedTsconfig(ctx: MutableCompilerContext) {
  const userConfig = getManagedTypeScriptConfig(ctx)
  const compilerOptions: CompilerOptions = {
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
    ...(userConfig?.shared?.compilerOptions ?? {}),
  }

  return {
    compilerOptions,
  }
}

function createAppTsconfig(ctx: MutableCompilerContext) {
  const userConfig = getManagedTypeScriptConfig(ctx)
  const userAppCompilerOptions = userConfig?.app?.compilerOptions ?? {}
  const compilerOptions: CompilerOptions = {
    tsBuildInfoFile: '../node_modules/.tmp/tsconfig.app.tsbuildinfo',
    target: 'ES2023',
    lib: ['ES2023', 'DOM', 'DOM.Iterable'],
    jsx: 'preserve',
    baseUrl: '..',
    resolveJsonModule: true,
    types: getAppTypes(ctx),
    allowJs: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    isolatedModules: true,
    ...userAppCompilerOptions,
    types: getAppTypes(ctx),
    paths: getAppPaths(ctx),
  }

  const vueCompilerOptions = {
    plugins: ['weapp-vite/volar'],
    ...(hasDependency(ctx.configService.packageJson, 'wevu') ? { lib: 'wevu' } : {}),
    ...(userConfig?.app?.vueCompilerOptions ?? {}),
  }

  return {
    extends: './tsconfig.shared.json',
    compilerOptions,
    vueCompilerOptions,
    include: unique([
      ...DEFAULT_APP_INCLUDE,
      ...(userConfig?.app?.include ?? []),
    ]),
  }
}

function createNodeTsconfig(ctx: MutableCompilerContext) {
  const userConfig = getManagedTypeScriptConfig(ctx)
  const compilerOptions: CompilerOptions = {
    tsBuildInfoFile: '../node_modules/.tmp/tsconfig.node.tsbuildinfo',
    target: 'ES2023',
    lib: ['ES2023'],
    types: ['node'],
    ...(userConfig?.node?.compilerOptions ?? {}),
  }

  return {
    extends: './tsconfig.shared.json',
    compilerOptions,
    include: unique([
      ...DEFAULT_NODE_INCLUDE,
      ...(userConfig?.node?.include ?? []),
    ]),
  }
}

export function createManagedTsconfigFiles(ctx: MutableCompilerContext): ManagedTsconfigFile[] {
  const managedDir = resolveManagedDir(ctx)
  const sharedPath = path.join(managedDir, 'tsconfig.shared.json')
  const appPath = path.join(managedDir, 'tsconfig.app.json')
  const nodePath = path.join(managedDir, 'tsconfig.node.json')

  return [
    {
      path: sharedPath,
      content: toJson(createSharedTsconfig(ctx)),
    },
    {
      path: appPath,
      content: toJson(createAppTsconfig(ctx)),
    },
    {
      path: nodePath,
      content: toJson(createNodeTsconfig(ctx)),
    },
  ]
}

export async function syncManagedTsconfigFiles(ctx: MutableCompilerContext) {
  for (const file of createManagedTsconfigFiles(ctx)) {
    await fs.outputFile(file.path, file.content, 'utf8')
  }
}

export async function syncManagedTsconfigBootstrapFiles(cwd: string) {
  const packageJsonPath = path.resolve(cwd, 'package.json')
  const packageJson = await fs.readJson(packageJsonPath, { throws: false }) ?? {}
  const bootstrapCtx = {
    configService: {
      cwd,
      configFilePath: undefined,
      packageJson,
      weappViteConfig: {},
    },
  } as MutableCompilerContext

  await syncManagedTsconfigFiles(bootstrapCtx)
}
