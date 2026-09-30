import type { ViteDevServer } from 'vite'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE } from '@weapp-core/constants'
import { createServer } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../src/vite'

it.each([true, false])('starts stateful in the native host, updates topology and closes (middleware: %s)', async (middlewareMode) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-stateful-host-'))
  let server: ViteDevServer | undefined
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"stateful-host-fixture","type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'src/app.ts': 'App({})',
      'config-value.mjs': 'export const message = "stateful-first"',
      'vite.config.mjs': `import { appendFileSync } from 'node:fs'
import { message } from './config-value.mjs'
appendFileSync(new URL('./config-calls.txt', import.meta.url), 'loaded\\n')
export default { define: { STATEFUL_MESSAGE: JSON.stringify(message) } }`,
      'src/app.json': '{"pages":["pages/home/index"]}',
      'src/pages/home/index.ts': 'Page({ data: { message: STATEFUL_MESSAGE } })',
      'src/pages/home/index.wxml': '<view>{{message}}</view>',
      'src/pages/home/index.json': '{}',
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    const start = () => createServer({
      root,
      configFile: path.join(root, 'vite.config.mjs'),
      plugins: [weapp()],
      logLevel: 'silent',
      server: { middlewareMode, port: 0, host: '127.0.0.1' },
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
    })
    server = await start()
    if (!middlewareMode) {
      await server.listen()
      const address = server.httpServer!.address() as { port: number }
      expect(await readFile(path.join(root, 'dist', WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')).toContain(`localhost:${address.port}`)
    }
    expect(await readFile(path.join(root, 'config-calls.txt'), 'utf8')).toBe('loaded\n')
    expect(server.config.experimental.bundledDev).toBe(true)
    expect(await readFile(path.join(root, 'dist/app.js'), 'utf8')).toContain('rolldown-runtime')
    expect(await readFile(path.join(root, 'dist/pages/home/index.js'), 'utf8')).toContain('stateful-first')
    await writeFile(path.join(root, 'src/pages/home/index.wxml'), '<view>stateful-template {{message}}</view>')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/home/index.wxml'), 'utf8'), { timeout: 10_000 }).toContain('stateful-template')
    await mkdir(path.join(root, 'src/pages/extra'), { recursive: true })
    await writeFile(path.join(root, 'src/pages/extra/index.ts'), 'Page({ data: { message: "stateful-added" } })')
    await writeFile(path.join(root, 'src/pages/extra/index.json'), '{}')
    await writeFile(path.join(root, 'src/pages/extra/index.wxml'), '<view>{{message}}</view>')
    await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/home/index","pages/extra/index"]}')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/extra/index.js'), 'utf8'), { timeout: 15_000 }).toContain('stateful-added')
    await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/home/index"]}')
    await rm(path.join(root, 'src/pages/extra'), { recursive: true })
    await expect.poll(() => readFile(path.join(root, 'dist/app.json'), 'utf8'), { timeout: 15_000 }).not.toContain('pages/extra/index')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/extra/index.js'), 'utf8').catch(error => error.code), { timeout: 15_000 }).toBe('ENOENT')
    await server.restart()
    await writeFile(path.join(root, 'src/pages/home/index.wxml'), '<view>stateful-restarted {{message}}</view>')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/home/index.wxml'), 'utf8'), { timeout: 10_000 }).toContain('stateful-restarted')
    const callsBefore = await readFile(path.join(root, 'config-calls.txt'), 'utf8')
    await writeFile(path.join(root, 'config-value.mjs'), 'export const message = "stateful-new-config"')
    await expect.poll(() => readFile(path.join(root, 'dist/pages/home/index.js'), 'utf8'), { timeout: 15_000 }).toContain('stateful-new-config')
    expect(await readFile(path.join(root, 'config-calls.txt'), 'utf8')).toBe(`${callsBefore}loaded\n`)
    await server.close()
    await server.close()
    await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ syntax error')
    await expect(start()).rejects.toThrow()
    await writeFile(path.join(root, 'src/pages/home/index.ts'), 'Page({ data: { message: STATEFUL_MESSAGE } })')
    server = await start()
    expect(await readFile(path.join(root, 'dist/pages/home/index.js'), 'utf8')).toContain('stateful-new-config')
    await server.close()
    await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/home/index"],"renderer":"skyline"}')
    await expect(start()).rejects.toThrow('Skyline 项目请显式选择')
  }
  finally {
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
}, 90_000)
