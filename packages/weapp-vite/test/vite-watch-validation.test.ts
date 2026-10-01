import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
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
