import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { expect, it } from 'vitest'
import config from '../vite.config'

it('watches fixture edits without subscribing to disposable build or type caches', { timeout: 15_000 }, async () => {
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
        server.watcher.on('change', file => changes.push(path.relative(root, file).replaceAll('\\', '/')))
        server.watcher.on('error', error => errors.push(error))
      },
    }],
  })
  try {
    await expect.poll(() => ready, { timeout: 10_000 }).toBe(true)
    const watched = Object.keys(server.watcher.getWatched()).map(directory => path.relative(root, directory).replaceAll('\\', '/'))
    expect(watched.some(directory => directory.split('/').some(part => part === '.cache' || part === '.weapp-vite'))).toBe(false)
    await rm(path.join(root, '.cache'), { recursive: true })
    await writeFile(path.join(fixture, 'index.js'), 'Page({ data: { value: 1 } })')
    await expect.poll(() => changes, { timeout: 5000 }).toContain('fixtures/native/index.js')
    expect(errors).toEqual([])
  }
  finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
