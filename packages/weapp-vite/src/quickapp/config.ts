import type { ConfigEnv, UserConfig } from 'vite'
import type { QuickAppBuildOptions, QuickAppConfig, ResolvedQuickAppConfig } from './types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { loadViteConfigFile } from '../utils/loadViteConfigFile'
import { resolveWeappConfigFile } from '../utils/weappConfig'

async function resolveQuickAppConfigFile(cwd: string, configFile?: string) {
  if (configFile) {
    return path.isAbsolute(configFile) ? configFile : path.resolve(cwd, configFile)
  }
  return resolveWeappConfigFile({ root: cwd })
}

export async function loadQuickAppConfig(options: QuickAppBuildOptions): Promise<ResolvedQuickAppConfig> {
  const cwd = path.resolve(options.cwd)
  const configFile = await resolveQuickAppConfigFile(cwd, options.configFile)
  const configEnv: ConfigEnv = {
    command: options.watch ? 'serve' : 'build',
    mode: options.mode ?? (options.watch ? 'development' : 'production'),
  }
  const loaded = await loadViteConfigFile(configEnv, configFile, cwd, undefined, undefined, 'runner')
  const quickapp = (loaded?.config as UserConfig & { quickapp?: QuickAppConfig } | undefined)?.quickapp ?? {}
  const srcDir = path.resolve(cwd, quickapp.srcDir ?? 'src')
  const outDir = path.resolve(cwd, quickapp.outDir ?? 'dist/quickapp')
  const testDir = quickapp.testDir === false
    ? undefined
    : path.resolve(cwd, quickapp.testDir ?? 'test')

  if (!await fs.pathExists(srcDir)) {
    throw new Error(`QuickApp 源码目录不存在：${path.relative(cwd, srcDir)}`)
  }

  return {
    cwd,
    srcDir,
    outDir,
    testDir,
    toolkit: {
      enabled: quickapp.toolkit?.enabled ?? true,
      e2e: options.e2e ?? quickapp.toolkit?.e2e ?? false,
      devtool: quickapp.toolkit?.devtool ?? 'source-map',
      args: [...(quickapp.toolkit?.args ?? [])],
    },
  }
}

declare module 'vite' {
  interface UserConfig {
    quickapp?: QuickAppConfig
  }
}
