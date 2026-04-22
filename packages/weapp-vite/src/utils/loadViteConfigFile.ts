import type { ConfigEnv, UserConfigExport } from 'vite'
import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'

const DEFAULT_VITE_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
]

const DEFAULT_VITE_CONFIG_FILE_SET = new Set<string>(DEFAULT_VITE_CONFIG_FILES)
export const TYPELESS_PACKAGE_JSON_WARNING_CODE = 'MODULE_TYPELESS_PACKAGE_JSON'
export type ViteConfigLoader = 'bundle' | 'runner' | 'native'

function resolveWarningCode(
  warning: string | Error,
  typeOrOptions?: string | { code?: string },
  code?: string,
) {
  if (warning instanceof Error && typeof (warning as Error & { code?: string }).code === 'string') {
    return (warning as Error & { code?: string }).code
  }
  if (typeOrOptions && typeof typeOrOptions === 'object' && typeof typeOrOptions.code === 'string') {
    return typeOrOptions.code
  }
  return code
}

async function withSuppressedWarningCodes<T>(
  suppressedCodes: string[] | undefined,
  fn: () => Promise<T>,
) {
  if (!suppressedCodes || suppressedCodes.length === 0) {
    return fn()
  }

  const suppressedCodeSet = new Set(suppressedCodes)
  const originalEmitWarning = process.emitWarning.bind(process)

  process.emitWarning = ((warning: string | Error, typeOrOptions?: string | { code?: string }, code?: string) => {
    const warningCode = resolveWarningCode(warning, typeOrOptions, code)
    if (warningCode && suppressedCodeSet.has(warningCode)) {
      return undefined
    }
    return originalEmitWarning(warning, typeOrOptions as any, code)
  }) as typeof process.emitWarning

  try {
    return await fn()
  }
  finally {
    process.emitWarning = originalEmitWarning
  }
}

export function isDefaultViteConfigBasename(filePath: string) {
  return DEFAULT_VITE_CONFIG_FILE_SET.has(path.basename(filePath))
}

async function resolveImplicitConfigFile(configRoot: string) {
  for (const fileName of DEFAULT_VITE_CONFIG_FILES) {
    const filePath = path.resolve(configRoot, fileName)
    try {
      await fs.access(filePath)
      return filePath
    }
    catch {
      continue
    }
  }
  return undefined
}

export async function loadViteConfigFile(
  configEnv: ConfigEnv,
  configFile: string | undefined,
  configRoot: string,
  configFileDependencies?: string[],
  configFileExport?: UserConfigExport,
  configLoader?: ViteConfigLoader,
  suppressedWarningCodes?: string[],
) {
  void configFileDependencies
  void configFileExport
  const resolvedConfigFile = configFile ?? await resolveImplicitConfigFile(configRoot)
  const resolvedConfigLoader = configLoader ?? 'bundle'
  return withSuppressedWarningCodes(
    suppressedWarningCodes,
    () => loadConfigFromFile(
      configEnv,
      resolvedConfigFile,
      configRoot,
      undefined,
      undefined,
      resolvedConfigLoader,
    ),
  )
}

export { DEFAULT_VITE_CONFIG_FILES }
