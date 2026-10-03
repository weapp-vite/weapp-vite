import type { RolldownWatcher } from 'rolldown'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'

it('keeps observing saves after publishing each native dependency topology', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vite-watch-topology-')))
  const input = path.join(root, 'entry.js')
  const output = path.join(root, 'dist/entry.js')
  let watcher: RolldownWatcher | undefined
  const errors: unknown[] = []
  const save = async (version: number) => {
    await writeFile(path.join(root, `value-${version}.js`), `export default "watch-value-${version}"`)
    await writeFile(input, `import value from "./value-${version}.js"; console.log(value)`)
  }
  try {
    await save(0)
    // 不加载框架插件，以原生 Vite 写出后立即保存的行为约束底层 watcher。
    watcher = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      build: {
        watch: {},
        minify: false,
        rolldownOptions: { input, output: { entryFileNames: 'entry.js' } },
      },
    }) as RolldownWatcher
    watcher.on('event', (event) => {
      if (event.code === 'ERROR') {
        errors.push(event.error)
      }
    })
    for (let version = 0; version <= 100; version++) {
      // 产物已发布即可继续编辑；不等待额外 END、预热或触发第二次保存。
      await expect.poll(() => readFile(output, 'utf8'), { timeout: 5000, interval: 2 })
        .toContain(`"watch-value-${version}"`)
      if (version < 100) {
        await save(version + 1)
      }
    }
    expect(errors).toEqual([])
  }
  finally {
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
