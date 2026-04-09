import type { Plugin } from 'vite'
import { writeFileSync } from 'node:fs'
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
}

interface RequestClientsRealDevRuntimeState {
  cleanupRegistered: boolean
  cleanupRunning: boolean
  devServerHandle: Awaited<ReturnType<typeof startRequestClientsRealServer>> | null
  initialized: boolean
  initializing: Promise<void> | null
  projectPrivateConfigSnapshot: { configPath: string, original: string } | null
}

const requestClientsRealDevRuntimeStateMap = new Map<string, RequestClientsRealDevRuntimeState>()

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

async function restoreProjectPrivateConfig(snapshot: { configPath: string, original: string } | null) {
  if (!snapshot) {
    return
  }
  await writeFile(snapshot.configPath, snapshot.original, 'utf8')
}

/**
 * @description 在 dev 启动时拉起真实请求服务，并自动改写项目启动 query。
 */
export async function requestClientsRealDevPlugin(options: RequestClientsRealDevPluginOptions): Promise<Plugin> {
  const state = requestClientsRealDevRuntimeStateMap.get(options.projectRoot) ?? {
    cleanupRegistered: false,
    cleanupRunning: false,
    devServerHandle: null,
    initialized: false,
    initializing: null,
    projectPrivateConfigSnapshot: null,
  }
  requestClientsRealDevRuntimeStateMap.set(options.projectRoot, state)

  async function cleanup() {
    if (state.cleanupRunning) {
      return
    }
    state.cleanupRunning = true

    await restoreProjectPrivateConfig(state.projectPrivateConfigSnapshot)
    state.projectPrivateConfigSnapshot = null

    if (!state.devServerHandle) {
      return
    }

    const handle = state.devServerHandle
    state.devServerHandle = null
    await handle.stop()
  }

  function cleanupSync() {
    if (state.cleanupRunning || !state.projectPrivateConfigSnapshot) {
      return
    }
    state.cleanupRunning = true
    writeFileSync(state.projectPrivateConfigSnapshot.configPath, state.projectPrivateConfigSnapshot.original, 'utf8')
    state.projectPrivateConfigSnapshot = null
  }

  function registerCleanup() {
    if (state.cleanupRegistered) {
      return
    }
    state.cleanupRegistered = true

    const asyncSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
    for (const signal of asyncSignals) {
      process.once(signal, () => {
        void cleanup().finally(() => {
          process.exit(0)
        })
      })
    }

    process.once('exit', () => {
      cleanupSync()
    })
  }

  async function setup() {
    if (state.initialized) {
      return
    }
    registerCleanup()

    state.devServerHandle = await startRequestClientsRealServer()
    state.projectPrivateConfigSnapshot = await patchProjectPrivateConfig(options.projectRoot, state.devServerHandle.baseUrl)
    state.initialized = true
  }

  if (!state.initialized) {
    state.initializing ??= setup().finally(() => {
      state.initializing = null
    })
    await state.initializing
  }

  return {
    name: 'request-clients-real-dev-plugin',
  }
}
