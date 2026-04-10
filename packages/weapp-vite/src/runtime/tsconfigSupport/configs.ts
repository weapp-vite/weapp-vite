import type { MutableCompilerContext } from '../../context'
import type { LegacyManagedTypeScriptConfig } from './types'
import { getPlatformAppTypesPackage } from '../../platform'
import { resolveBaseDir } from '../autoImport/config/base'
import { requireConfigService } from '../utils/requireConfigService'
import {
  DEFAULT_APP_INCLUDE,
  DEFAULT_NODE_INCLUDE,
  getManagedTypeScriptConfig,
  hasDependency,
  mergePaths,
  normalizeSrcRoot,
  rebaseManagedPaths,
  resolveManagedDir,
  unique,
} from './shared'

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
  const normalizedSrcRoot = normalizeSrcRoot(configService.srcRoot)
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

export function createSharedTsconfig(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
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

export function createAppTsconfig(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
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

export function createNodeTsconfig(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
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

export function createServerTsconfig(ctx: MutableCompilerContext, legacyConfig?: LegacyManagedTypeScriptConfig) {
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
