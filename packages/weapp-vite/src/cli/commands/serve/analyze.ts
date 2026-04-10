import type { RolldownWatcher } from 'rolldown'
import type { AnalyzeSubpackagesResult } from '../../../analyze/subpackages'
import type { AnalyzeDashboardHandle, DashboardRuntimeEventInput, startAnalyzeDashboard } from '../../analyze/dashboard'
import type { RuntimeTargets } from '../../runtime'
import type { GlobalCLIOptions } from '../../types'
import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { analyzeSubpackages } from '../../../analyze/subpackages'
import { createCompilerContext } from '../../../createContext'
import logger from '../../../logger'
import { createInlineConfig } from '../../runtime'

const REG_DIST_PAGE_ENTRY = /pages\/.+\/index\.js$/
const REG_DIST_POSIX_SEP = /\\/g

function emitDashboardEvents(handle: AnalyzeDashboardHandle | undefined, events: DashboardRuntimeEventInput[]) {
  handle?.emitRuntimeEvents(events)
}

function hasAnalyzeData(result: AnalyzeSubpackagesResult) {
  return result.packages.length > 0 || result.modules.length > 0
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

export interface AnalyzeRunResult {
  result: AnalyzeSubpackagesResult
  durationMs: number
  mode: 'full' | 'fallback'
  fallbackReason?: string
}

export async function analyzeUiFallback(ctx: Awaited<ReturnType<typeof createCompilerContext>>): Promise<AnalyzeSubpackagesResult> {
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

export function createAnalyzeController(options: {
  configFile: string | undefined
  ctx: Awaited<ReturnType<typeof createCompilerContext>>
  options: GlobalCLIOptions
  targets: RuntimeTargets
}) {
  const { configFile, ctx, options: cliOptions, targets } = options
  const { configService } = ctx
  let analyzeRunId = 0
  let analyzeHandle: AnalyzeDashboardHandle | undefined

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
        projectConfigPath: cliOptions.projectConfig,
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

  const bindWatcher = (buildResult: unknown) => {
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
    return {
      async runInitialUpdate() {
        if (analyzeHandle) {
          updating = true
          await triggerAnalyzeUpdate('initial')
          updating = false
        }
      },
    }
  }

  return {
    getHandle: () => analyzeHandle,
    async startDashboard(
      startDashboard: typeof startAnalyzeDashboard,
    ) {
      const initialAnalyze = await runAnalyze()
      analyzeHandle = await startDashboard(initialAnalyze.result, {
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
    },
    bindWatcher,
    emitRuntimeEvents(events: DashboardRuntimeEventInput[]) {
      emitDashboardEvents(analyzeHandle, events)
    },
    waitForExit() {
      return analyzeHandle?.waitForExit()
    },
  }
}
