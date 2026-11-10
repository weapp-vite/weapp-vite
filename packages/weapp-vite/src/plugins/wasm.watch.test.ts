import type { CompilerContext } from '../context'
import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createWasmPlugin } from './wasm'

it('keeps cached init ownership across watch rebuilds and releases removed imports', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wasm-watch-'))
  const entry = path.join(root, 'entry.js')
  const initEntry = path.join(root, 'init.js')
  const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
  await writeFile(path.join(root, 'add.wasm'), bytes)
  await writeFile(initEntry, 'import init from "./add.wasm?init"; globalThis.init = init')
  await writeFile(entry, 'import "./init.js"; globalThis.version = 1')
  const ctx = { configService: { platform: 'weapp' } } as unknown as CompilerContext
  let assetDirectory = 'assets'
  const watcher = await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: 'silent',
    plugins: [createWasmPlugin(ctx, { scope: 'app', reservedRoots: ['regular'] })],
    build: {
      watch: {},
      assetsInlineLimit: 0,
      rolldownOptions: { input: entry, output: { entryFileNames: 'entry.js', assetFileNames: () => `${assetDirectory}/[name][extname]` } },
    },
  })
  if (!('on' in watcher)) {
    throw new Error('Expected a watch build')
  }
  const waitForBuild = () => new Promise<void>((resolve, reject) => {
    const onEvent: Parameters<typeof watcher.on<'event'>>[1] = (event) => {
      if (event.code === 'END' || event.code === 'ERROR') {
        watcher.off('event', onEvent)
        if (event.code === 'ERROR') {
          reject(event.error)
        }
        else {
          resolve()
        }
      }
    }
    watcher.on('event', onEvent)
  })
  try {
    await waitForBuild()
    const dist = path.join(root, 'dist')
    expect(await readFile(path.join(dist, 'assets/add.wasm'))).toEqual(Buffer.from(bytes))
    const second = waitForBuild()
    await writeFile(entry, 'import "./init.js"; globalThis.version = 2')
    await second
    expect(await readFile(path.join(dist, 'entry.js'), 'utf8')).toContain('/assets/add.wasm')
    expect(await readFile(path.join(dist, 'assets/add.wasm'))).toEqual(Buffer.from(bytes))
    const third = waitForBuild()
    assetDirectory = 'regular'
    await writeFile(entry, 'import url from "./add.wasm?url"; globalThis.url = url')
    await third
    expect(await readFile(path.join(dist, 'regular/add.wasm'))).toEqual(Buffer.from(bytes))
    expect(await readFile(path.join(dist, 'entry.js'), 'utf8')).not.toContain('WXWebAssembly')
  }
  finally {
    await watcher.close()
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
