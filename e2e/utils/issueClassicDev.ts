import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { expect } from 'vitest'
import { waitForStableDistSnapshot } from '../../scripts/workspace-hmr/output'
import { startDevProcess } from './dev-process'
import { createDevProcessEnv } from './dev-process-env'

const CLI = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

export function startIssueClassicDev(project: string) {
  return startDevProcess(process.execPath, [CLI, 'dev', '--platform', 'weapp', '--non-interactive'], {
    cwd: project,
    env: createDevProcessEnv(),
  })
}

export async function waitForIssuePublication(project: string, dev: ReturnType<typeof startIssueClassicDev>) {
  await dev.waitFor(waitForStableDistSnapshot(path.join(project, 'dist'), 300, 30_000), 'complete classic output publication')
  expect(dev.getBuildErrors()).toEqual([])
}

/** 检查最终 app.json 的所有页面，避免 headless 可加载而 IDE 拒绝残缺的页面文件。 */
export async function assertIssuePageArtifacts(project: string) {
  const dist = path.join(project, 'dist')
  const app = JSON.parse(await readFile(path.join(dist, 'app.json'), 'utf8')) as {
    pages?: string[]
    subPackages?: Array<{ root: string, pages: string[] }>
    subpackages?: Array<{ root: string, pages: string[] }>
  }
  const pages = [
    ...(app.pages ?? []),
    ...(app.subPackages ?? app.subpackages ?? []).flatMap(group => group.pages.map(page => `${group.root}/${page}`)),
  ]
  expect(pages).not.toHaveLength(0)
  for (const page of pages) {
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(dist, `${page}.${extension}`))
    }
  }
  return app
}

/** 观察整个稳定窗口而非固定等待后取一次快照，捕获 30 秒清理与自激重建。 */
export async function assertClassicDevRemainsStable(dev: ReturnType<typeof startIssueClassicDev>, milliseconds: number, inspect: () => Promise<void>) {
  const rebuilds = () => dev.getOutput().match(/小程序已重新构建/g)?.length ?? 0
  const before = rebuilds()
  const deadline = Date.now() + milliseconds
  await dev.waitFor((async () => {
    while (true) {
      expect(dev.getBuildErrors()).toEqual([])
      expect(rebuilds(), 'idle classic dev must not rebuild its generated sources').toBe(before)
      await inspect()
      if (Date.now() >= deadline) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(500, deadline - Date.now())))
    }
  })(), 'classic dev stability observation')
}
