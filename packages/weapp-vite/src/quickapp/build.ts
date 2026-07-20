import type { QuickAppBuildOptions, QuickAppBuildResult, QuickAppDevSession, ResolvedQuickAppConfig } from './types'
import chokidar from 'chokidar'
import { build as viteBuild } from 'vite'
import { createWeappViteHostMeta } from '../pluginHost'
import { loadQuickAppConfig } from './config'
import { createQuickAppPlugin, QUICKAPP_ENTRY_ID } from './plugin'
import { prepareHapToolkitProject, runHapToolkitBuild, runHapToolkitWatch } from './toolkit'

function createQuickAppViteConfig(config: ResolvedQuickAppConfig, mode: string) {
  return {
    root: config.cwd,
    configFile: false as const,
    publicDir: false as const,
    logLevel: 'warn' as const,
    mode,
    weappVite: createWeappViteHostMeta('quickapp', 'quickapp'),
    plugins: [createQuickAppPlugin(config)],
    build: {
      outDir: config.outDir,
      emptyOutDir: true,
      rolldownOptions: {
        input: QUICKAPP_ENTRY_ID,
      },
    },
  }
}

export async function buildQuickApp(options: QuickAppBuildOptions): Promise<QuickAppBuildResult> {
  const config = await loadQuickAppConfig(options)
  await viteBuild(createQuickAppViteConfig(config, options.mode ?? 'production'))
  const rpkFiles = config.toolkit.enabled
    ? await runHapToolkitBuild(config)
    : []
  return {
    config,
    rpkFiles,
  }
}

export async function serveQuickApp(options: QuickAppBuildOptions): Promise<QuickAppDevSession> {
  const config = await loadQuickAppConfig({ ...options, watch: true })
  const mode = options.mode ?? 'development'
  await viteBuild(createQuickAppViteConfig(config, mode))
  const hapWatch = config.toolkit.enabled ? await runHapToolkitWatch(config) : undefined
  const hapProcess = hapWatch?.process
  const watchTargets = [config.srcDir, config.testDir].filter((value): value is string => Boolean(value))
  const sourceWatcher = chokidar.watch(watchTargets, {
    ignoreInitial: true,
  })
  await new Promise<void>(resolve => sourceWatcher.once('ready', () => resolve()))
  let restartTimer: ReturnType<typeof setTimeout> | undefined
  let rebuildQueue = Promise.resolve()
  sourceWatcher.on('all', () => {
    if (restartTimer) {
      clearTimeout(restartTimer)
    }
    restartTimer = setTimeout(() => {
      rebuildQueue = rebuildQueue.then(async () => {
        await viteBuild(createQuickAppViteConfig(config, mode))
        if (config.toolkit.enabled) {
          await prepareHapToolkitProject(config)
        }
      })
    }, 20)
  })
  const waitForExit = hapProcess
    ? hapProcess.then(() => undefined).catch((error) => {
        if (!hapProcess.killed) {
          throw error
        }
      })
    : new Promise<void>(() => {})
  return {
    config,
    async close() {
      if (restartTimer) {
        clearTimeout(restartTimer)
      }
      await sourceWatcher.close()
      await rebuildQueue
      if (hapProcess && !hapProcess.killed) {
        hapProcess.kill('SIGTERM')
      }
    },
    waitForExit: () => waitForExit,
  }
}
