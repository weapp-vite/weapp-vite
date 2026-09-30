import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createWorkerHost } from '../src/runtime/workerHost'
import { cleanupTempDirs } from './helpers'
import { workerFiles } from './helpers/workers'

const directories: string[] = []
afterEach(() => cleanupTempDirs(directories))
it.each(['node', 'browser'] as const)('runs worker messages, structured copies and termination in %s', async (provider) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-worker-'))
  directories.push(projectPath)
  for (const [file, source] of workerFiles) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = provider === 'node'
    ? createHeadlessSession({ projectPath })
    : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(workerFiles) })
  try {
    const first = session.reLaunch('/pages/index')
    await expect.poll(() => first.data).toMatchObject({ message: 'worker hello', mainScope: 'main', workerScope: 'worker' })
    first.send()
    await expect.poll(() => first.data).toMatchObject({ message: 'echo', count: 1 })
    first.send()
    const second = session.reLaunch('/pages/index')
    await expect.poll(() => second.data).toMatchObject({ message: 'worker hello', count: 0 })
    second.send()
    await expect.poll(() => second.data).toMatchObject({ message: 'echo', count: 1 })
    expect(first.data).toMatchObject({ message: 'echo', count: 1 })
    expect(session.getDiagnostics()).toEqual([])
  }
  finally { session.close() }
})

it('does not evaluate queued async modules after the worker host closes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-worker-close-')).replaceAll('\\', '/')
  directories.push(root)
  const files = new Map([
    [`${root}/app.json`, '{"workers":"workers"}'],
    [`${root}/workers/index.js`, 'entry'],
    [`${root}/workers/late.js`, 'late'],
  ])
  const executed: string[] = []
  let pending: Promise<unknown> | undefined
  const host = createWorkerHost({
    root,
    read: file => files.get(file),
    console,
    createExecutor: () => (source, _file, _module, require) => {
      executed.push(source)
      if (source === 'entry') {
        pending = (require as typeof require & { async: (id: string) => Promise<unknown> }).async('./late')
        host.close()
      }
    },
  })
  try {
    host.apis.createWorker('workers/index.js')
    await expect.poll(() => pending !== undefined).toBe(true)
    await pending
    expect(executed).toEqual(['entry'])
  }
  finally {
    host.close()
  }
})
