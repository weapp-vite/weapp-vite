import type { InlineConfig } from 'vite'
import type { WeappWebConfig } from '../../types'
import type { ResolvedWeappWebConfig } from './types'
import path from 'pathe'

interface ResolveWebConfigOptions {
  cwd: string
  srcRoot: string
  config?: WeappWebConfig
}

function normalizeSrcDir(root: string, cwd: string, srcRoot: string, config?: WeappWebConfig) {
  if (!config) {
    const absoluteSrc = path.resolve(cwd, srcRoot)
    return path.relative(root, absoluteSrc) || ''
  }

  if (config.srcDir) {
    if (path.isAbsolute(config.srcDir)) {
      return path.relative(root, config.srcDir)
    }
    return config.srcDir
  }

  const absoluteSrc = path.resolve(cwd, srcRoot)
  return path.relative(root, absoluteSrc) || ''
}

function normalizeOutDir(root: string, config?: WeappWebConfig) {
  if (!config?.outDir) {
    return path.resolve(root, 'dist-web')
  }
  if (path.isAbsolute(config.outDir)) {
    return config.outDir
  }
  return path.resolve(root, config.outDir)
}

export function resolveWeappWebConfig(options: ResolveWebConfigOptions): ResolvedWeappWebConfig | undefined {
  const { cwd, srcRoot, config } = options
  if (!config) {
    return undefined
  }

  const enabled = config.enable !== false
  if (!enabled) {
    return undefined
  }

  const root = config.root ? path.resolve(cwd, config.root) : cwd
  const srcDir = normalizeSrcDir(root, cwd, srcRoot, config)
  const outDir = normalizeOutDir(root, config)
  const pluginOptions = {
    ...(config.pluginOptions ?? {}),
    srcDir,
  }

  const userConfig: InlineConfig | undefined = config.vite

  return {
    enabled: true,
    root,
    srcDir,
    outDir,
    pluginOptions,
    userConfig,
    source: config,
  }
}
