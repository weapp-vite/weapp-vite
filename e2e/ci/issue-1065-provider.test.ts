import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createIssue1065Project, runIssue1065Command } from '../utils/issue1065Project'
import { runWithCleanup } from '../utils/runWithCleanup'

it('consumes a third-party provider through CLI source, output, bundle and lifecycle hooks', async () => {
  const project = await createIssue1065Project()
  try {
    await runIssue1065Command(project, 'build')
    const read = (name: string) => readFile(path.join(project, 'dist', name), 'utf8')
    expect(await read('app.wxss')).toContain('#123456')
    expect(await read('pages/home/index.wxss')).toContain('#ff0000')
    expect(await read('pages/home/index.wxss')).toContain('provider-finalized')
    expect(await read('pages/home/index.wxml')).toContain('template-after')
    expect(await read('pages/home/index.js')).toContain('script-after')
    const events = (await readFile(path.join(project, 'provider-events.jsonl'), 'utf8')).trim().split('\n').map(line => (JSON.parse(line) as { event: string }).event)
    expect(events).toEqual(expect.arrayContaining(['source', 'css', 'template', 'script', 'finalize', 'buildStart', 'closeBundle']))
    expect(events.filter(event => event === 'dispose')).toHaveLength(1)
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
}, 60_000)

it('rejects two providers claiming the same CSS source through CLI', async () => {
  const project = await createIssue1065Project()
  try {
    const filename = path.join(project, 'weapp-vite.config.ts')
    await writeFile(filename, (await readFile(filename, 'utf8')).replace('fakeProvider()]', 'fakeProvider(), fakeProvider(\'conflicting-provider\')]'))
    await expect(runIssue1065Command(project, 'build')).rejects.toThrow('所有权冲突')
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
}, 60_000)

it('watches provider dependencies across consecutive CLI updates', async () => {
  const project = await createIssue1065Project()
  const root = path.resolve(import.meta.dirname, '../..')
  const dev = startDevProcess(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', project, '--skipNpm'], { cwd: root, env: createDevProcessEnv(), all: true, ipc: true })
  await runWithCleanup(async () => {
    await dev.waitForInitialBuild()
    await dev.waitForOutput('开发服务已就绪', 'watcher is ready')
    await delay(1_000)
    for (const color of ['#0000ff', '#00ff00', '#ff0000']) {
      await writeFile(path.join(project, 'src/provider.tokens.json'), JSON.stringify({ color }))
      await dev.waitFor(expect.poll(() => readFile(path.join(project, 'dist/pages/home/index.wxss'), 'utf8'), { timeout: 30_000 }).toContain(color), 'provider dependency rebuild')
    }
    const events = await readFile(path.join(project, 'provider-events.jsonl'), 'utf8')
    expect(events).toContain('watch:provider.tokens.json')
    expect(events).not.toContain('dispose')
    await dev.stop(5_000)
    const closed = await readFile(path.join(project, 'provider-events.jsonl'), 'utf8')
    expect(closed.split('\"event\":\"dispose\"').length - 1).toBe(1)
  }, async () => {
    await dev.stop(5_000)
    await rm(project, { recursive: true, force: true })
  })
}, 150_000)
