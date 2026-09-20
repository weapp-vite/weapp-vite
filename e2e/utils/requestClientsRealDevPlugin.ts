import type { Plugin } from 'vite'
import { realpathSync, writeFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { startRequestClientsRealServer } from './requestClientsRealServer'

interface ProjectPrivateConfigConditionEntry {
  launchMode?: string
  name?: string
  pathName?: string
  query?: string
  scene?: number | null
}

interface ProjectPrivateConfigShape {
  condition?: {
    miniprogram?: {
      list?: ProjectPrivateConfigConditionEntry[]
    }
  }
}

export interface RequestClientsRealDevPluginOptions {
  projectRoot: string
  serverPort?: number
}

export interface RequestClientsRealDevSetupResult {
  baseUrl: string
  plugin: Plugin
  stop: () => Promise<void>
}

interface RequestClientsRealDevRuntimeState {
  serverPort: number | undefined
  setup: Promise<RequestClientsRealDevSetupResult>
}

// Vite runner 为每次配置加载创建模块实例；服务归进程所有，不能放在模块缓存内。
const runtimeStateKey = Symbol.for('weapp-vite.e2e.request-clients-real-dev-runtime')
const runtimeGlobal = globalThis as typeof globalThis & {
  [runtimeStateKey]?: Map<string, RequestClientsRealDevRuntimeState>
}
const requestClientsRealDevRuntimeStateMap = runtimeGlobal[runtimeStateKey] ??= new Map()

/**
 * @description 为测试页 query 合并本地真实服务地址。
 */
export function mergeRequestClientsRealQuery(query: string | undefined, baseUrl: string) {
  const params = new URLSearchParams(query ?? '')
  params.set('baseUrl', baseUrl)
  return params.toString()
}

/**
 * @description 将 baseUrl 批量注入到 project.private.config.json 的启动条件中。
 */
export function injectBaseUrlIntoProjectPrivateConfig(source: string, baseUrl: string) {
  const config = JSON.parse(source) as ProjectPrivateConfigShape
  const list = config.condition?.miniprogram?.list
  if (!Array.isArray(list) || list.length === 0) {
    return source
  }

  for (const entry of list) {
    entry.query = mergeRequestClientsRealQuery(entry.query, baseUrl)
  }

  return `${JSON.stringify(config, null, 2)}\n`
}

async function patchProjectPrivateConfig(projectRoot: string, baseUrl: string) {
  const configPath = path.resolve(projectRoot, 'project.private.config.json')
  const original = await readFile(configPath, 'utf8')
  const next = injectBaseUrlIntoProjectPrivateConfig(original, baseUrl)
  if (next !== original) {
    await writeFile(configPath, next, 'utf8')
  }
  return {
    configPath,
    original,
  }
}

function createBaseUrlModuleSource(baseUrl: string) {
  return [
    '/**',
    ' * @description dev 启动时由插件写入的真实请求服务地址。',
    ' */',
    `export const REQUEST_CLIENTS_REAL_DEV_BASE_URL = ${JSON.stringify(baseUrl)}`,
    '',
  ].join('\n')
}

async function patchGeneratedBaseUrlModule(projectRoot: string, baseUrl: string) {
  const filePath = path.resolve(projectRoot, 'src/shared/requestClientsRealDevBaseUrl.ts')
  const original = await readFile(filePath, 'utf8')
  const next = createBaseUrlModuleSource(baseUrl)
  if (next !== original) {
    await writeFile(filePath, next, 'utf8')
  }
  return {
    filePath,
    original,
  }
}

async function startDevRuntime(options: RequestClientsRealDevPluginOptions): Promise<RequestClientsRealDevSetupResult> {
  let devServerHandle: Awaited<ReturnType<typeof startRequestClientsRealServer>> | undefined
  let projectPrivateConfigSnapshot: Awaited<ReturnType<typeof patchProjectPrivateConfig>> | undefined
  let generatedBaseUrlModuleSnapshot: Awaited<ReturnType<typeof patchGeneratedBaseUrlModule>> | undefined
  let stopping: Promise<void> | undefined
  const removeCleanupListeners: Array<() => void> = []

  function restoreSnapshotsSync() {
    if (projectPrivateConfigSnapshot) {
      writeFileSync(projectPrivateConfigSnapshot.configPath, projectPrivateConfigSnapshot.original, 'utf8')
      projectPrivateConfigSnapshot = undefined
    }
    if (generatedBaseUrlModuleSnapshot) {
      writeFileSync(generatedBaseUrlModuleSnapshot.filePath, generatedBaseUrlModuleSnapshot.original, 'utf8')
      generatedBaseUrlModuleSnapshot = undefined
    }
  }

  function cleanup() {
    stopping ??= Promise.resolve().then(async () => {
      try {
        restoreSnapshotsSync()
      }
      finally {
        try {
          await devServerHandle?.stop()
        }
        finally {
          requestClientsRealDevRuntimeStateMap.delete(options.projectRoot)
          for (const removeListener of removeCleanupListeners) {
            removeListener()
          }
        }
      }
    })
    return stopping
  }

  function handleSignal() {
    // 配置文件还在写入时也必须先等待初始化结束，再恢复原始内容。
    const setup = requestClientsRealDevRuntimeStateMap.get(options.projectRoot)?.setup
    void Promise.resolve(setup).catch(() => {}).then(cleanup).finally(() => process.exit(0))
  }

  process.once('SIGINT', handleSignal)
  process.once('SIGTERM', handleSignal)
  process.once('exit', restoreSnapshotsSync)
  removeCleanupListeners.push(
    () => { process.removeListener('SIGINT', handleSignal) },
    () => { process.removeListener('SIGTERM', handleSignal) },
    () => { process.removeListener('exit', restoreSnapshotsSync) },
  )

  try {
    devServerHandle = await startRequestClientsRealServer({ port: options.serverPort })
    projectPrivateConfigSnapshot = await patchProjectPrivateConfig(options.projectRoot, devServerHandle.baseUrl)
    generatedBaseUrlModuleSnapshot = await patchGeneratedBaseUrlModule(options.projectRoot, devServerHandle.baseUrl)
    return {
      baseUrl: devServerHandle.baseUrl,
      plugin: { name: 'request-clients-real-dev-plugin' },
      stop: cleanup,
    }
  }
  catch (error) {
    await cleanup()
    throw error
  }
}

/**
 * @description 在 dev 启动时复用进程内的真实请求服务，并自动改写项目启动 query。
 */
export async function requestClientsRealDevPlugin(
  options: RequestClientsRealDevPluginOptions,
): Promise<RequestClientsRealDevSetupResult> {
  const projectRoot = realpathSync(options.projectRoot)
  const existing = requestClientsRealDevRuntimeStateMap.get(projectRoot)
  if (existing) {
    if (existing.serverPort !== options.serverPort) {
      throw new Error('同一请求客户端测试项目不能同时使用不同的服务端口。')
    }
    return existing.setup
  }

  const state = {
    serverPort: options.serverPort,
    setup: startDevRuntime({ ...options, projectRoot }),
  }
  requestClientsRealDevRuntimeStateMap.set(projectRoot, state)
  return state.setup
}
