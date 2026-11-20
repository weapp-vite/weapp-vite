import type { HeadlessSession } from '../../mpcore/packages/simulator/src'
import { unwatchFile, watchFile } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src'

/** 模拟 IDE 私有配置变更触发的 AppService 重建，确认请求仍由磁盘上的旧程序发出。 */
export function observeHeadlessHmrConfigReload(session: HeadlessSession, attach: (runtime: HeadlessSession) => () => void | Promise<void>) {
  const project = session.project
  const file = project && path.join(project.projectPath, 'project.private.config.json')
  let closeRuntime: (() => Promise<void>) | undefined
  let closed = false
  let reload = Promise.resolve()
  const check = () => {
    reload = reload.then(async () => {
      if (!file || closed || closeRuntime) {
        return
      }
      const source = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          throw error
        }
      })
      const config = source && JSON.parse(source.replace(/^\uFEFF/u, '')) as { setting?: { compileHotReLoad?: boolean } }
      if (!config || config.setting?.compileHotReLoad !== false || closed) {
        return
      }
      const route = session.evaluateRuntime<string | undefined>('() => getCurrentPages().at(-1)?.route')
      const runtime = createHeadlessSession({ projectPath: project.projectPath })
      closeRuntime = async () => runtime.close()
      const detach = attach(runtime)
      closeRuntime = async () => {
        try {
          await detach()
        }
        finally {
          runtime.close()
        }
      }
      if (route) {
        runtime.reLaunch(`/${route}`)
      }
      else {
        runtime.bootstrap()
      }
    })
    void reload.catch(() => {})
  }
  if (file) {
    watchFile(file, { interval: 100, persistent: false }, check)
  }
  return async () => {
    closed = true
    if (file) {
      unwatchFile(file, check)
    }
    try {
      await reload
    }
    finally {
      await closeRuntime?.()
    }
  }
}
