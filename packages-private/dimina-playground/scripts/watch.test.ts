import { watch } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { expect, it } from 'vitest'
import config from '../vite.config'

it.each([false, true])('watches fixture edits without subscribing to disposable caches (remove cache: %s)', { timeout: 15_000 }, async (removeCache) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'dimina-watch-')))
  const fixture = path.join(root, 'fixtures/native')
  const generated = ['.cache/build-test/native/weapp', 'fixtures/native/.weapp-vite']
  await mkdir(fixture, { recursive: true })
  await writeFile(path.join(fixture, 'index.js'), 'Page({})')
  for (const directory of generated) {
    await mkdir(path.join(root, directory), { recursive: true })
    await writeFile(path.join(root, directory, 'index.js'), 'generated')
  }
  let ready = false
  const changes: string[] = []
  const errors: Error[] = []
  const nativeEvents: string[] = []
  const watcherEvents: string[] = []
  const source = path.join(fixture, 'index.js')
  let nativeWatcher: ReturnType<typeof watch> | undefined
  const server = await createServer({
    configFile: false,
    root,
    server: { ...config.server, hmr: false },
    plugins: [{
      name: 'observe-watch-scope',
      configureServer(server) {
        server.watcher.on('ready', () => {
          ready = true
        })
        server.watcher.on('all', (event, file) => watcherEvents.push(`${event}:${path.relative(root, file).replaceAll('\\', '/')}`))
        server.watcher.on('change', file => changes.push(path.relative(root, file).replaceAll('\\', '/')))
        server.watcher.on('error', error => errors.push(error))
      },
    }],
  })
  try {
    // 原生监听只观察同一次真实保存，区分系统事件缺失与 Vite 事件过滤。
    nativeWatcher = watch(fixture, (event, file) => nativeEvents.push(`${event}:${String(file)}`))
    nativeWatcher.on('error', error => errors.push(error))
    await expect.poll(() => ready, { timeout: 10_000 }).toBe(true)
    // Vite 初始路径并行扫描时，ready 可能先于嵌套目录注册；真实保存必须在目标已订阅后发生。
    await expect.poll(() => Object.entries(server.watcher.getWatched()).some(([directory, files]) =>
      path.resolve(directory) === path.resolve(fixture) && files.includes('index.js'),
    ), { timeout: 10_000 }).toBe(true)
    const watched = Object.keys(server.watcher.getWatched()).map(directory => path.relative(root, directory).replaceAll('\\', '/'))
    expect(watched.some(directory => directory.split('/').some(part => part === '.cache' || part === '.weapp-vite'))).toBe(false)
    const before = await stat(source)
    if (removeCache) {
      await rm(path.join(root, '.cache'), { recursive: true })
    }
    await writeFile(source, 'Page({ data: { value: 1 } })')
    try {
      await expect.poll(() => changes, { timeout: 5000 }).toContain('fixtures/native/index.js')
    }
    catch (cause) {
      const after = await stat(source)
      throw new Error(`Fixture watch observation: ${JSON.stringify({
        removeCache,
        nativeEvents,
        watcherEvents,
        watched,
        errors: errors.map(error => error.message),
        before: { size: before.size, mtimeMs: before.mtimeMs },
        after: { size: after.size, mtimeMs: after.mtimeMs },
        sourceChanged: await readFile(source, 'utf8') === 'Page({ data: { value: 1 } })',
      })}`, { cause })
    }
    expect(errors).toEqual([])
  }
  finally {
    nativeWatcher?.close()
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
