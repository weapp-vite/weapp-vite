import type { CAC } from 'cac'
import type { RolldownWatcher } from 'rolldown'
import type { ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import type { AnalyzeDashboardHandle, DashboardRuntimeEventInput } from '../analyze/dashboard'
import type { GlobalCLIOptions } from '../types'
import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { startDevHotkeys } from '../devHotkeys'
import { formatDuration } from '../formatDuration'
import { maybeStartForwardConsole } from '../forwardConsole'
import { logBuildAppFinish } from '../logBuildAppFinish'
import { openIde, resolveIdeProjectRoot } from '../openIde'
import { filterDuplicateOptions, isUiEnabled, resolveConfigFile } from '../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../runtime'

function emitDashboardEvents(handle: AnalyzeDashboardHandle | undefined, events: DashboardRuntimeEventInput[]) {
  handle?.emitRuntimeEvents(events)
}

function resolveWebHost(host: GlobalCLIOptions['host']) {
  if (host === undefined) {
    return undefined
  }
  if (typeof host === 'boolean') {
    return host
  }
  if (typeof host === 'string') {
    return host
  }
  return String(host)
}

const REG_DIST_PAGE_ENTRY = /pages\/.+\/index\.js$/
const REG_DIST_POSIX_SEP = /\\/g

function hasAnalyzeData(result: AnalyzeSubpackagesResult) {
  return result.packages.length > 0 || result.modules.length > 0
}

interface AnalyzeRunResult {
  result: AnalyzeSubpackagesResult
  durationMs: number
  mode: 'full' | 'fallback'
  fallbackReason?: string
}

async function collectOutputFiles(root: string) {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectOutputFiles(absolutePath))
      continue
    }
    if (entry.isFile()) {
      files.push(absolutePath)
    }
  }

  return files
}

async function analyzeUiFallback(ctx: Awaited<ReturnType<typeof createCompilerContext>>): Promise<AnalyzeSubpackagesResult> {
  const { configService, scanService } = ctx
  await scanService.loadAppEntry()
  const subPackageMetas = scanService.loadSubPackages()
  const distRoot = configService.outDir
  const absoluteFiles = await collectOutputFiles(distRoot)
  const packages = new Map<string, AnalyzeSubpackagesResult['packages'][number]>()

  const ensurePackage = (packageId: string, packageType: 'main' | 'subPackage' | 'independent') => {
    const existing = packages.get(packageId)
    if (existing) {
      return existing
    }
    const label = packageId === '__main__'
      ? '主包'
      : packageType === 'independent'
        ? `独立分包 ${packageId}`
        : `分包 ${packageId}`
    const created: AnalyzeSubpackagesResult['packages'][number] = {
      id: packageId,
      label,
      type: packageType,
      files: [],
    }
    packages.set(packageId, created)
    return created
  }

  const classifyPackage = (relativeFile: string) => {
    const normalized = relativeFile.replace(REG_DIST_POSIX_SEP, '/')
    for (const meta of subPackageMetas) {
      const root = meta.subPackage.root
      if (root && normalized.startsWith(`${root}/`)) {
        return {
          id: root,
          type: meta.subPackage.independent ? 'independent' as const : 'subPackage' as const,
        }
      }
    }
    return {
      id: '__main__',
      type: 'main' as const,
    }
  }

  for (const absoluteFile of absoluteFiles) {
    const relativeFile = path.relative(distRoot, absoluteFile).replace(REG_DIST_POSIX_SEP, '/')
    const packageInfo = classifyPackage(relativeFile)
    const stat = await fs.stat(absoluteFile)
    const fileEntry = ensurePackage(packageInfo.id, packageInfo.type)
    fileEntry.files.push({
      file: relativeFile,
      type: relativeFile.endsWith('.js') ? 'chunk' : 'asset',
      from: packageInfo.type === 'independent' ? 'independent' : 'main',
      size: stat.size,
      isEntry: relativeFile === 'app.js' || REG_DIST_PAGE_ENTRY.test(relativeFile),
      source: relativeFile.endsWith('.js') ? undefined : relativeFile,
    })
  }

  return {
    packages: Array.from(packages.values()).sort((a, b) => {
      if (a.id === '__main__') {
        return -1
      }
      if (b.id === '__main__') {
        return 1
      }
      return a.id.localeCompare(b.id)
    }),
    modules: [],
    subPackages: subPackageMetas
      .map(meta => ({
        root: meta.subPackage.root ?? '',
        independent: Boolean(meta.subPackage.independent),
        name: meta.subPackage.name,
      }))
      .filter(item => item.root)
      .sort((a, b) => a.root.localeCompare(b.root)),
  }
}

export function registerServeCommand(cli: CAC) {
  cli
    .command('[root]', 'start dev server') // 默认命令
    .alias('serve') // 与 Vite API 的命令名保持一致
    .alias('dev') // 与脚本名对齐的别名
    .option('--skipNpm', `[boolean] if skip npm build`)
    .option('-o, --open', `[boolean] open ide`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5 | all)`)
    .option('--project-config <path>', `[string] project config path (miniprogram only)`)
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .option('--host [host]', `[string] web dev server host`)
    .option('--ui', `[boolean] 启动调试 UI（当前提供分析视图）`, { default: false })
    .option('--analyze', `[boolean] 启动分包分析仪表盘 (实验特性)`, { default: false })
    .action(async (root: string, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      let inlineConfig = createInlineConfig(targets.mpPlatform)
      if (targets.runWeb) {
        const host = resolveWebHost(options.host)
        if (host !== undefined) {
          inlineConfig = {
            ...inlineConfig,
            server: {
              ...(inlineConfig?.server ?? {}),
              host,
            },
          }
        }
        if (targets.runMini) {
          const buildWatch = typeof inlineConfig?.build?.watch === 'object' && inlineConfig.build.watch
            ? inlineConfig.build.watch
            : {}
          const buildChokidar = 'chokidar' in buildWatch
            ? (buildWatch as { chokidar?: Record<string, unknown> }).chokidar
            : undefined
          const existingServer = inlineConfig?.server ?? {}
          inlineConfig = {
            ...inlineConfig,
            build: {
              ...(inlineConfig?.build ?? {}),
              watch: {
                ...buildWatch,
                chokidar: {
                  ...(buildChokidar ?? {}),
                  usePolling: true,
                  interval: 100,
                },
              },
            },
            server: {
              ...existingServer,
              ...(existingServer.port === undefined ? { port: 0 } : {}),
              watch: {
                ...(existingServer.watch ?? {}),
                usePolling: true,
                interval: 100,
              },
            },
          }
        }
      }
      const ctx = await createCompilerContext({
        cwd: root,
        mode: options.mode ?? 'development',
        isDev: true,
        configFile,
        inlineConfig,
        cliPlatform: targets.rawPlatform,
        projectConfigPath: options.projectConfig,
      })
      const { buildService, configService, webService } = ctx
      logRuntimeTarget(targets, { resolvedConfigPlatform: configService.platform })
      const enableAnalyze = Boolean(isUiEnabled(options) && targets.runMini)
      let analyzeHandle: AnalyzeDashboardHandle | undefined
      let analyzeRunId = 0
      const devHotkeysSession = targets.runMini
        ? startDevHotkeys({
            cwd: configService.cwd,
            mcpConfig: configService.weappViteConfig?.weapp?.mcp,
            platform: configService.platform,
            projectPath: resolveIdeProjectRoot(configService.mpDistRoot, configService.cwd),
          })
        : undefined

      try {
        const runAnalyze = async (): Promise<AnalyzeRunResult> => {
          const startedAt = Date.now()
          try {
            const analyzeCtx = await createCompilerContext({
              key: `serve-ui-analyze:${process.pid}:${++analyzeRunId}`,
              cwd: configService.cwd,
              mode: configService.mode,
              isDev: false,
              configFile,
              inlineConfig: createInlineConfig(targets.mpPlatform),
              cliPlatform: targets.rawPlatform,
              projectConfigPath: options.projectConfig,
              syncSupportFiles: false,
            })
            const result = await analyzeSubpackages(analyzeCtx)
            if (hasAnalyzeData(result)) {
              return {
                result,
                durationMs: Date.now() - startedAt,
                mode: 'full',
              }
            }
          }
          catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.warn(`[ui] 完整分析失败，已回退到 dist 文件扫描：${message}`)
            return {
              result: await analyzeUiFallback(ctx),
              durationMs: Date.now() - startedAt,
              mode: 'fallback',
              fallbackReason: message,
            }
          }

          return {
            result: await analyzeUiFallback(ctx),
            durationMs: Date.now() - startedAt,
            mode: 'fallback',
            fallbackReason: '完整分析结果为空，已回退到 dist 文件扫描。',
          }
        }

        const triggerAnalyzeUpdate = async (reason: 'initial' | 'watch' = 'watch') => {
          if (!analyzeHandle) {
            return
          }
          emitDashboardEvents(analyzeHandle, [
            {
              kind: reason === 'watch' ? 'hmr' : 'build',
              level: 'info',
              title: reason === 'watch' ? 'analyze refresh started' : 'initial analyze started',
              detail: reason === 'watch'
                ? '检测到新的构建结束事件，开始刷新 analyze 面板。'
                : '开发态 UI 已启动，开始生成第一份 analyze 结果。',
              tags: reason === 'watch' ? ['watch', 'analyze'] : ['initial', 'analyze'],
            },
          ])
          const next = await runAnalyze()
          if (next.mode === 'fallback') {
            emitDashboardEvents(analyzeHandle, [
              {
                kind: 'diagnostic',
                level: 'warning',
                title: 'analyze fallback enabled',
                detail: next.fallbackReason ?? '完整分析不可用，已回退到 dist 文件扫描。',
                durationMs: next.durationMs,
                tags: ['analyze', 'fallback'],
              },
            ])
          }
          await analyzeHandle.update(next.result)
          emitDashboardEvents(analyzeHandle, [
            {
              kind: next.mode === 'fallback' ? 'diagnostic' : 'build',
              level: next.mode === 'fallback' ? 'warning' : 'success',
              title: reason === 'watch' ? 'analyze refresh completed' : 'initial analyze completed',
              detail: next.mode === 'fallback'
                ? `analyze 已回退到 dist 扫描，当前包含 ${next.result.packages.length} 个包。`
                : `analyze 已刷新完成，当前包含 ${next.result.packages.length} 个包与 ${next.result.modules.length} 个模块。`,
              durationMs: next.durationMs,
              tags: next.mode === 'fallback'
                ? ['analyze', 'fallback']
                : ['analyze', reason === 'watch' ? 'refresh' : 'initial'],
            },
          ])
        }

        if (targets.runMini) {
          const miniBuildStartedAt = Date.now()
          const buildResult = await buildService.build(options)
          logger.success(`小程序初次构建完成，耗时：${formatDuration(Date.now() - miniBuildStartedAt)}`)

          if (enableAnalyze) {
            const initialAnalyze = await runAnalyze()
            analyzeHandle = await startAnalyzeDashboard(initialAnalyze.result, {
              watch: true,
              cwd: configService.cwd,
              packageManagerAgent: configService.packageManager.agent,
              silentStartupLog: true,
            }) ?? undefined
            emitDashboardEvents(analyzeHandle, [
              {
                kind: 'command',
                level: 'success',
                title: 'dev ui session ready',
                detail: `开发态分析面板已启动，当前包含 ${initialAnalyze.result.packages.length} 个包。`,
                durationMs: initialAnalyze.durationMs,
                tags: ['dev', 'ui'],
              },
            ])
            if (initialAnalyze.mode === 'fallback') {
              emitDashboardEvents(analyzeHandle, [
                {
                  kind: 'diagnostic',
                  level: 'warning',
                  title: 'initial analyze fallback enabled',
                  detail: initialAnalyze.fallbackReason ?? '完整分析不可用，已回退到 dist 文件扫描。',
                  durationMs: initialAnalyze.durationMs,
                  tags: ['analyze', 'fallback', 'initial'],
                },
              ])
            }

            let updating = false
            if (analyzeHandle && buildResult && typeof (buildResult as RolldownWatcher).on === 'function') {
              const watcher = buildResult as RolldownWatcher
              watcher.on('event', (event) => {
                if (event.code !== 'END' || updating) {
                  return
                }
                updating = true
                triggerAnalyzeUpdate('watch').finally(() => {
                  updating = false
                })
              })
            }
            if (analyzeHandle) {
              updating = true
              await triggerAnalyzeUpdate('initial')
              updating = false
            }
          }
        }
        let webServer: ViteDevServer | undefined
        if (targets.runWeb) {
          const webServerStartedAt = Date.now()
          try {
            webServer = await webService?.startDevServer()
            logger.success(`Web 开发服务启动完成，耗时：${formatDuration(Date.now() - webServerStartedAt)}`)
            emitDashboardEvents(analyzeHandle, [
              {
                kind: 'system',
                level: 'success',
                title: 'web dev server started',
                detail: 'Web 开发服务器已启动，可与小程序调试 UI 并行工作。',
                durationMs: Date.now() - webServerStartedAt,
                tags: ['dev', 'web'],
              },
            ])
          }
          catch (error) {
            emitDashboardEvents(analyzeHandle, [
              {
                kind: 'diagnostic',
                level: 'error',
                title: 'web dev server failed',
                detail: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - webServerStartedAt,
                tags: ['dev', 'web'],
              },
            ])
            logger.error(error)
            throw error
          }
        }
        if (targets.runMini) {
          logBuildAppFinish(configService, webServer, {
            skipWeb: !targets.runWeb,
            uiUrls: analyzeHandle?.urls,
          })
        }
        else if (targets.runWeb) {
          logBuildAppFinish(configService, webServer, { skipMini: true })
        }
        if (options.open && targets.runMini) {
          emitDashboardEvents(analyzeHandle, [
            {
              kind: 'command',
              level: 'info',
              title: 'opening ide',
              detail: '开发服务已就绪，准备打开 IDE 项目。',
              tags: ['ide', 'open'],
            },
          ])
          const openedByForwardConsole = await maybeStartForwardConsole({
            platform: configService.platform,
            mpDistRoot: configService.mpDistRoot,
            cwd: configService.cwd,
            weappViteConfig: configService.weappViteConfig,
          })
          if (!openedByForwardConsole) {
            await openIde(configService.platform, resolveIdeProjectRoot(configService.mpDistRoot, configService.cwd), {
              trustProject: options.trustProject,
            })
          }
          devHotkeysSession?.restore()
        }

        if (analyzeHandle) {
          await analyzeHandle.waitForExit()
        }
      }
      finally {
        devHotkeysSession?.close()
      }
    })
}
