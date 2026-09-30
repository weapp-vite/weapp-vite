import type { RolldownWatcher } from 'rolldown'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../src/vite'

it('keeps an edit to another entry made while the previous round is still writing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-watch-inflight-'))
  const writing = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let watcher: RolldownWatcher | undefined
  let hold = false
  let held = false
  let rounds = 0
  const write = async (file: string, content: string) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
  try {
    await write('package.json', '{"type":"module"}')
    await write('project.config.json', '{"miniprogramRoot":"dist"}')
    await write('src/app.ts', 'App({})')
    await write('src/app.json', '{"pages":["pages/first/index","pages/second/index"]}')
    for (const page of ['first', 'second']) {
      await write(`src/pages/${page}/index.ts`, `Page({ data: { marker: "${page}-initial" } })`)
      await write(`src/pages/${page}/index.json`, '{}')
      await write(`src/pages/${page}/index.wxml`, '<view>{{marker}}</view>')
    }
    watcher = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp(), {
        name: 'hold-first-update-write',
        async writeBundle() {
          if (hold && !held) {
            held = true
            writing.resolve()
            await release.promise
          }
        },
      }],
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false } },
      build: { watch: {}, minify: false },
    }) as RolldownWatcher
    watcher.on('event', (event) => {
      if (event.code === 'BUNDLE_END') {
        rounds++
      }
    })
    await expect.poll(() => rounds, { timeout: 10_000 }).toBe(1)
    hold = true
    await write('src/pages/first/index.ts', 'Page({ data: { marker: "first-updated" } })')
    await writing.promise
    await write('src/pages/second/index.ts', 'Page({ data: { marker: "second-during-write" } })')
    release.resolve()
    await expect.poll(() => readFile(path.join(root, 'dist/pages/second/index.js'), 'utf8'), { timeout: 10_000 }).toContain('second-during-write')
    expect(await readFile(path.join(root, 'dist/pages/first/index.js'), 'utf8')).toContain('first-updated')
  }
  finally {
    release.resolve()
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
