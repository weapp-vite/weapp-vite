import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createIssue1072Project, runIssue1072Command } from '../utils/issue1072Project'

it('passes static page metadata through the CLI into emitted page JSON', async () => {
  const project = await createIssue1072Project()
  try {
    await runIssue1072Command(project, 'build')
    for (const page of ['home', 'external', 'dynamic']) {
      const config = JSON.parse(await readFile(path.join(project, `dist/pages/${page}/index.json`), 'utf8')) as Record<string, unknown>
      expect(config.navigationBarTitleText).toBe(`${page}:${page === 'dynamic' ? 'dynamic' : 'static'}`)
      for (const extension of ['js', 'wxml']) {
        expect(await readFile(path.join(project, `dist/pages/${page}/index.${extension}`), 'utf8')).not.toBe('')
      }
    }
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
}, 60_000)

it('preserves metadata during JSON-only updates and restoration', async () => {
  const project = await createIssue1072Project()
  const root = path.resolve(import.meta.dirname, '../..')
  const dev = startDevProcess(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', project, '--skipNpm'], {
    cwd: root,
    env: createDevProcessEnv(),
    all: true,
  })
  const filename = path.join(project, 'src/pages/home/index.vue')
  const source = await readFile(filename, 'utf8')
  const config = async () => JSON.parse(await readFile(path.join(project, 'dist/pages/home/index.json'), 'utf8')) as Record<string, unknown>
  try {
    await dev.waitForInitialBuild()
    await dev.waitForOutput('开发服务已就绪', 'watcher is ready')
    await delay(1_000)
    for (const enabled of [true, false]) {
      await writeFile(filename, source.replace('enablePullDownRefresh: false', `enablePullDownRefresh: ${enabled}`))
      await dev.waitFor(expect.poll(config, { timeout: 60_000 }).toMatchObject({
        navigationBarTitleText: 'home:static',
        enablePullDownRefresh: enabled,
      }), 'JSON-only update retains compile metadata')
    }
  }
  finally {
    await dev.stop(5_000)
    await rm(project, { recursive: true, force: true })
  }
}, 180_000)
