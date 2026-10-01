import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { parseLogicalEntryId } from '../src/moduleGraph/protocol'
import { weapp } from '../src/vite'
import { WeappBuildSession } from '../src/vite/session'

it('validates the scanned config even when the watcher invalidates shared state before validation resumes', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-watch-validation-')))
  const session = new WeappBuildSession()
  const scanned = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  try {
    await mkdir(path.join(root, 'src'))
    for (const [file, content] of Object.entries({
      'package.json': '{"type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'src/app.ts': 'App({})',
      'src/app.json': '{"pages":[],"workers":"workers"}',
    })) {
      await writeFile(path.join(root, file), content)
    }
    await session.prepare({ root, configFile: false, weapp: { srcRoot: 'src', autoRoutes: false } }, root, 'production')
    const scan = session.context.scanService
    const load = scan.loadAppEntry.bind(scan)
    scan.loadAppEntry = async () => {
      const entry = await load()
      scanned.resolve()
      // 控制扫描完成与调用者恢复之间的失效时序，仍读取真实配置文件。
      await resume.promise
      return entry
    }
    const validation = session.validateEntries()
    const outcome = validation.then(() => undefined, error => error)
    await scanned.promise
    scan.markDirty()
    resume.resolve()
    expect(await outcome).toBeInstanceOf(Error)
    expect(String(await outcome)).toContain('weapp.worker.entry')
  }
  finally {
    resume.resolve()
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

it.each([
  { autoRoutes: false, workers: 'workers' },
  { autoRoutes: true, workers: { path: 'workers' } },
])('rejects worker config edited after startup validation with autoRoutes=$autoRoutes', async ({ autoRoutes, workers }) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-watch-publication-')))
  let edited = false
  try {
    await mkdir(path.join(root, 'src'))
    for (const [file, content] of Object.entries({
      'package.json': '{"type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'src/app.ts': 'App({})',
      'src/app.json': '{"pages":[]}',
    })) {
      await writeFile(path.join(root, file), content)
    }
    const outcome = await build({
      root,
      configFile: false,
      plugins: [weapp(), {
        name: 'edit-before-app-collection',
        load: {
          order: 'pre',
          async handler(id) {
            if (!edited && parseLogicalEntryId(id)?.type === 'app') {
              edited = true
              // 只改变真实源配置，固定启动校验后、入口收集前的用户保存时序。
              await writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: [], workers }))
            }
          },
        },
      }],
      logLevel: 'silent',
      weapp: { srcRoot: 'src', autoRoutes, vue: { enable: false } },
      build: { minify: false },
    }).then(() => undefined, (error: unknown) => error)
    expect(edited).toBe(true)
    expect(outcome).toBeInstanceOf(Error)
    expect(String(outcome)).toContain('weapp.worker.entry')
    expect(await readFile(path.join(root, 'dist/app.json'), 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return ''
      }
      throw error
    })).not.toContain('workers')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
