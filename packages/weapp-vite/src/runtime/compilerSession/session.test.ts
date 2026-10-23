import type { InlineConfig } from 'vite'
import type { WatcherInstance } from '../watcherPlugin'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalize } from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { getActiveCompilerContextKey } from '../../context/getInstance'
import { getInitialBuildInputObservation } from '../buildPlugin/initialBuildChanges'
import { installIdeAssetWatch } from '../statefulHmr/assetWatch'
import { deferWatcherResourceCleanup } from '../watcherPlugin'
import { restartCompilerContextInputObservation } from './context'
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
    return session.context.configService.options
  })
  const initializing = session.initialize({ hostConfig: { config: {} }, syncSupportFiles: false, preloadAppEntry: false })
  const rejected = expect(initializing).rejects.toThrow('已关闭')
  await started.promise
  const closing = session.close()
  expect(getInitialBuildInputObservation(session.context.configService)).toBeUndefined()
  expect(session.close()).toBe(closing)
  expect(cleanup).not.toHaveBeenCalled()
  finish.resolve()
  await rejected
  await closing
  expect(cleanup).toHaveBeenCalledOnce()
  expect(session.state).toBe('closed')
})

it('releases initialized input ownership when closed before starting a build', async () => {
  const session = createSession()
  expect(getInitialBuildInputObservation(session.context.configService)).toBeUndefined()
  vi.spyOn(session.context.configService, 'load').mockResolvedValue(session.context.configService.options)
  await session.initialize({ hostConfig: { config: {} }, syncSupportFiles: false, preloadAppEntry: false })
  expect(getInitialBuildInputObservation(session.context.configService)).toBeDefined()
  const closing = session.close()
  expect(getInitialBuildInputObservation(session.context.configService)).toBeUndefined()
  await closing
  expect(session.state).toBe('closed')
})

it('does not leave an observer behind when close races the previous watcher drain', async () => {
  const session = createSession()
  const started = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  session.context.watcherService.rollupWatcherMap.set('/', {
    async close() {
      started.resolve()
      await finish.promise
    },
  } as WatcherInstance)
  vi.spyOn(session.context.configService, 'load').mockResolvedValue(session.context.configService.options)
  const initializing = session.initialize({ hostConfig: { config: {} }, syncSupportFiles: false, preloadAppEntry: false })
  const rejected = expect(initializing).rejects.toThrow('已关闭')
  await started.promise
  const closing = session.close()
  expect(getInitialBuildInputObservation(session.context.configService)).toBeUndefined()
  finish.resolve()
  await rejected
  await closing
  expect(getInitialBuildInputObservation(session.context.configService)).toBeUndefined()
  expect(session.state).toBe('closed')
})

it('does not let an initialization failure release a replacement input generation', async () => {
  const session = createSession()
  const failure = new Error('old initialization failed')
  let replacement: ReturnType<typeof getInitialBuildInputObservation>
  vi.spyOn(session.context.configService, 'load').mockImplementation(async () => {
    restartCompilerContextInputObservation(session.context)
    replacement = getInitialBuildInputObservation(session.context.configService)
    throw failure
  })
  await expect(session.initialize({ hostConfig: { config: {} }, syncSupportFiles: false, preloadAppEntry: false })).rejects.toBe(failure)
  expect(replacement).toBeDefined()
  expect(getInitialBuildInputObservation(session.context.configService)).toBe(replacement)
})

it('recognizes restored IDE configuration consumed by the new session and retains later user edits', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-compiler-config-input-'))
  roots.push(root)
  const configPath = path.join(root, 'project.private.config.json')
  const original = '{"projectname":"user-project","setting":{"compileHotReLoad":true,"urlCheck":false}}'
  await writeFile(path.join(root, 'package.json'), '{"name":"compiler-config-input"}')
  await writeFile(path.join(root, 'project.config.json'), '{"miniprogramRoot":"dist"}')
  await writeFile(configPath, original)
  const restore = await installIdeAssetWatch({ configPath, outDir: path.join(root, 'dist') })
  await restore()
  const session = createSession()
  await session.initialize({
    cwd: root,
    hostConfig: { config: { weapp: { autoRoutes: false, vue: { enable: false } } } },
    syncSupportFiles: false,
    preloadAppEntry: false,
  })
  expect(session.context.configService.projectPrivateConfig).toEqual(JSON.parse(original))
  const observation = getInitialBuildInputObservation(session.context.configService)!
  observation.begin()
  observation.commit()
  const change = { event: 'update', file: configPath, verifyInitialInput: true }
  expect(await observation.filter([change])).toEqual([])
  expect(await readFile(configPath, 'utf8')).toBe(original)
  await writeFile(configPath, '{"projectname":"user-edited","setting":{"compileHotReLoad":false,"urlCheck":true}}')
  expect(await observation.filter([change])).toEqual([change])
  await writeFile(configPath, original)
  expect(await observation.filter([change])).toEqual([change])
})

it('releases startup observations when parsing real project configuration fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-compiler-invalid-config-'))
  roots.push(root)
  await writeFile(path.join(root, 'package.json'), '{"name":"compiler-invalid-config"}')
  await writeFile(path.join(root, 'project.config.json'), '{"miniprogramRoot":"dist"}')
  await writeFile(path.join(root, 'project.private.config.json'), '{invalid')
  const session = createSession()
  await expect(session.initialize({
    cwd: root,
    hostConfig: { config: {} },
    syncSupportFiles: false,
    preloadAppEntry: false,
  })).rejects.toThrow('非法的 json 格式')
  expect(getInitialBuildInputObservation(session.context.configService)).toBeUndefined()
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
  expect(getInitialBuildInputObservation(session.context.configService)).toBeUndefined()
  await session.close()
  expect(cleanup).toHaveBeenCalledOnce()
})
