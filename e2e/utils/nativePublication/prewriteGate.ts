import type { Plugin } from 'vite'
import { randomUUID } from 'node:crypto'
import { watch } from 'node:fs'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const gateRoot = (project: string) => path.join(project, '.tmp/native-prewrite-gate')

async function exists(file: string) {
  return access(file).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return false
    }
    throw error
  })
}

async function waitForSignal(file: string, timeoutMs: number, signal?: AbortSignal) {
  signal?.throwIfAborted()
  const completed = Promise.withResolvers<void>()
  let active = true
  const check = async () => {
    try {
      if (await exists(file) && active) {
        completed.resolve()
      }
    }
    catch (error) {
      completed.reject(error)
    }
  }
  const watcher = watch(path.dirname(file), { persistent: false }, () => {
    void check()
  })
  watcher.on('error', error => completed.reject(error))
  const abort = () => completed.reject(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  // 文件状态是完成依据；目录通知可合并或遗漏，只负责提前唤醒核对。
  const interval = setInterval(() => {
    void check()
  }, 25)
  const deadline = setTimeout(() => {
    completed.reject(new Error(`Timed out waiting for native prewrite gate ${path.basename(file)}`))
  }, timeoutMs)
  try {
    void check()
    await completed.promise
  }
  finally {
    active = false
    watcher.close()
    clearInterval(interval)
    clearTimeout(deadline)
    signal?.removeEventListener('abort', abort)
  }
}

/** 每次门闩使用独占信号；释放只消费自身 arm，不删除其他发布请求。 */
export async function armNativePrewriteGate(project: string) {
  const root = gateRoot(project)
  const token = randomUUID()
  const directory = path.join(root, token)
  await mkdir(directory, { recursive: true })
  const armed = path.join(root, 'armed')
  await writeFile(armed, token, { flag: 'wx' })
  let releasing: Promise<void> | undefined
  return {
    waitEntered: (timeoutMs = 90_000, signal?: AbortSignal) => waitForSignal(path.join(directory, 'entered'), timeoutMs, signal),
    release: () => releasing ??= (async () => {
      await writeFile(path.join(directory, 'release'), '')
      const current = await readFile(armed, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          return undefined
        }
        throw error
      })
      if (current === token) {
        await rm(armed)
      }
    })(),
  }
}

/** 只阻挡真实原生发布前的单个代次；配置重复解析及重复插件不重复取得门闩。 */
export function nativePrewriteGatePlugin(): Plugin {
  return {
    name: 'e2e:native-prewrite-gate',
    enforce: 'post',
    apply: (config, { command }) => command === 'build' && config.build?.write !== false,
    generateBundle: {
      order: 'post',
      sequential: true,
      async handler(outputOptions) {
        const config = this.environment.config
        if (config.plugins.some(plugin => plugin.name === 'weapp-vite:workers')
          || path.resolve(config.root, outputOptions.dir ?? config.build.outDir) !== path.resolve(config.root, config.build.outDir)) {
          return
        }
        const root = gateRoot(config.root)
        const token = await readFile(path.join(root, 'armed'), 'utf8').catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') {
            return undefined
          }
          throw error
        })
        if (!token) {
          return
        }
        if (!/^[a-f\d-]{36}$/.test(token)) {
          throw new Error('Invalid native prewrite gate token')
        }
        const directory = path.join(root, token)
        try {
          await mkdir(path.join(directory, 'claimed'))
        }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
            return
          }
          throw error
        }
        await writeFile(path.join(directory, 'entered'), '')
        await waitForSignal(path.join(directory, 'release'), 90_000)
      },
    },
  }
}
