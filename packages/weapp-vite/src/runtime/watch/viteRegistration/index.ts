import type { Stats } from 'node:fs'
import type { ViteDevServer } from 'vite'
import { lstat, readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { compileIgnored } from '../viteAdapter/options'

type RegistrationState = 'registered' | 'closed'
const editorTemporaryFile = /\..*\.(?:swp|swx)$|~$|\.subl.*\.tmp/

function missing(error: unknown) {
  return ['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')
}

function ignorePredicate(watcher: ViteDevServer['watcher']) {
  const options = watcher.options
  const ignored = compileIgnored(options.ignored, options.cwd)
  return (file: string, stats: Stats) => {
    if (options.atomic && editorTemporaryFile.test(file)) {
      return true
    }
    return ignored(file, stats)
  }
}

/** 只证明本代已存在输入已登记；实际保存交付由原生宿主和端到端契约验证。 */
export function createViteInputRegistration(server: ViteDevServer, roots: string[]) {
  const completion = Promise.withResolvers<RegistrationState>()
  const watcher = server.watcher
  let finished = false
  let cancelled = false
  let closing: Promise<void> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let unregisterError = () => {}
  const pending = new Set<string>()
  const operations = new Set<Promise<void>>()
  const lateFailures = new Set<unknown>()
  const track = (operation: Promise<void>) => {
    operations.add(operation)
    void operation.then(() => operations.delete(operation), () => operations.delete(operation))
    return operation
  }
  const normalize = (file: string) => {
    const resolved = path.resolve(file)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  const cleanup = () => {
    clearTimeout(timer)
    clearTimeout(deadline)
    unregisterError()
    pending.clear()
  }
  const finish = (state: RegistrationState) => {
    if (!finished) {
      finished = true
      cleanup()
      completion.resolve(state)
    }
  }
  function fail(error: unknown) {
    if (cancelled) {
      lateFailures.add(error)
    }
    if (!finished) {
      finished = true
      cleanup()
      completion.reject(error)
    }
  }
  const collect = async (file: string, depth: number, ancestors: Set<string>, ignored: ReturnType<typeof ignorePredicate>) => {
    if (finished) {
      return
    }
    let info: Stats
    try {
      info = await lstat(file)
      if (info.isSymbolicLink()) {
        if (watcher.options.followSymlinks === false) {
          return
        }
        info = await stat(file)
      }
      if (ignored(file, info)) {
        return
      }
      if (info.isDirectory()) {
        if (watcher.options.depth !== undefined && depth > watcher.options.depth) {
          return
        }
        const identity = await realpath(file)
        if (ancestors.has(identity)) {
          return
        }
        const next = new Set([...ancestors, identity])
        for (const name of await readdir(file)) {
          await collect(path.join(file, name), depth + 1, next, ignored)
        }
      }
      else if (info.isFile()) {
        pending.add(normalize(file))
      }
    }
    catch (error) {
      if (!missing(error) && !(watcher.options.ignorePermissionErrors && ['EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? ''))) {
        throw error
      }
    }
  }
  const check = async () => {
    if (finished) {
      return
    }
    try {
      const base = watcher.options.cwd ?? process.cwd()
      for (const [directory, files] of Object.entries(watcher.getWatched())) {
        for (const file of files) {
          pending.delete(normalize(path.resolve(base, directory, file)))
        }
      }
      for (const file of pending) {
        try {
          await lstat(file)
        }
        catch (error) {
          if (missing(error)) {
            pending.delete(file)
          }
          else {
            throw error
          }
        }
      }
      if (!pending.size) {
        finish('registered')
      }
      else if (!finished) {
        timer = setTimeout(() => {
          void track(check())
        }, 10)
      }
    }
    catch (error) {
      fail(error)
    }
  }
  if (server.config.server.watch === null || server.config.experimental.bundledDev) {
    finish('registered')
  }
  else {
    watcher.on('error', fail)
    unregisterError = () => {
      watcher.off('error', fail)
    }
    deadline = setTimeout(() => fail(new Error('[weapp-vite] 初始源码监听登记超时，开发产物尚未就绪。')), 30_000)
    void track((async () => {
      const ignored = ignorePredicate(watcher)
      for (const root of roots) {
        const relative = path.relative(server.config.root, root)
        const depth = relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
          ? relative.split(path.sep).length
          : 0
        await collect(root, depth, new Set(), ignored)
      }
      await check()
    })().catch(fail))
  }
  const cancel = () => {
    cancelled = true
    finish('closed')
  }
  return {
    ready: completion.promise,
    cancel,
    close: () => {
      cancel()
      return closing ??= (async () => {
        await Promise.allSettled([...operations])
        const errors = [...lateFailures]
        if (errors.length) {
          throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Input registration cleanup failed', { cause: errors[0] })
        }
      })()
    },
  }
}
