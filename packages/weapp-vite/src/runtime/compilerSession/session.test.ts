import type { InlineConfig } from 'vite'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalize } from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { getActiveCompilerContextKey } from '../../context/getInstance'
import { deferWatcherResourceCleanup } from '../watcherPlugin'
import { CompilerSession } from './index'

const sessions: CompilerSession[] = []
const roots: string[] = []
afterEach(async () => {
  await Promise.allSettled(sessions.splice(0).map(session => session.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function createSession() {
  const session = new CompilerSession()
  sessions.push(session)
  return session
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

it('initializes separate projects without changing the active compiler context', async () => {
  const active = getActiveCompilerContextKey()
  const projects = await Promise.all(['first', 'second'].map(async (name) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-compiler-session-'))
    roots.push(root)
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name }))
    await writeFile(path.join(root, 'project.config.json'), '{"miniprogramRoot":"dist"}')
    const config: InlineConfig = { weapp: { srcRoot: name, autoRoutes: false, vue: { enable: false } } }
    const session = createSession()
    await session.initialize({ cwd: root, hostConfig: { config }, syncSupportFiles: false, preloadAppEntry: false })
    return { session, root, name }
  }))
  expect(getActiveCompilerContextKey()).toBe(active)
  expect(projects[0]!.session.context).not.toBe(projects[1]!.session.context)
  for (const { session, name, root } of projects) {
    expect(session.context.configService.srcRoot).toBe(name)
    expect(session.context.configService.cwd).toBe(normalize(root))
    await expect(readFile(path.join(root, '.weapp-vite/tsconfig.app.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  }
  await projects[0]!.session.close()
  expect(projects[1]!.session.state).toBe('ready')
})

it('waits for initialization before cleanup and rejects startup that was closed', async () => {
  const session = createSession()
  const started = deferred()
  const finish = deferred()
  const cleanup = vi.fn()
  session.onClose(cleanup)
  vi.spyOn(session.context.configService, 'load').mockImplementation(async () => {
    started.resolve()
    await finish.promise
  })
  const initializing = session.initialize({ hostConfig: { config: {} }, syncSupportFiles: false, preloadAppEntry: false })
  const rejected = expect(initializing).rejects.toThrow('已关闭')
  await started.promise
  const closing = session.close()
  expect(session.close()).toBe(closing)
  expect(cleanup).not.toHaveBeenCalled()
  finish.resolve()
  await rejected
  await closing
  expect(cleanup).toHaveBeenCalledOnce()
  expect(session.state).toBe('closed')
})

it('waits for all accepted jobs and runs every cleanup after a sibling job fails', async () => {
  const session = createSession()
  session.state = 'ready'
  const finish = deferred()
  const error = new Error('compilation failed')
  const order: string[] = []
  session.onClose(() => {
    order.push('first')
  })
  session.onClose(() => {
    order.push('second')
    throw new Error('cleanup failed')
  })
  deferWatcherResourceCleanup(session.context.watcherService, () => {
    order.push('owned watcher')
  })
  const pending = session.run(async () => {
    await finish.promise
    order.push('job finished')
  })
  await expect(session.run(async () => {
    throw error
  })).rejects.toBe(error)
  const closing = session.close()
  const rejected = expect(closing).rejects.toThrow('resource cleanup failed')
  expect(order).toEqual([])
  await expect(session.run(async () => {})).rejects.toThrow('closing')
  expect(() => session.onClose(() => {})).toThrow('不能接管')
  finish.resolve()
  await pending
  await rejected
  expect(order).toEqual(['job finished', 'second', 'first', 'owned watcher'])
  expect(session.state).toBe('closed')
  expect(session.close()).toBe(closing)
})

it('keeps initialization errors intact and releases partially initialized resources', async () => {
  const session = createSession()
  const error = new Error('invalid configuration')
  const cleanup = vi.fn()
  vi.spyOn(session.context.configService, 'load').mockImplementation(async () => {
    deferWatcherResourceCleanup(session.context.watcherService, cleanup)
    throw error
  })
  await expect(session.initialize({ hostConfig: { config: {} } })).rejects.toBe(error)
  await session.close()
  expect(cleanup).toHaveBeenCalledOnce()
})
