import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 以独立进程隔离准备流程和测试模块缓存。
import { execa } from 'execa'
import { syncManagedTsconfigBootstrapFilesRecursively } from '../../vitest.globalSetup.mjs'

async function prepareTemplateTypeScriptProjects() {
  await syncManagedTsconfigBootstrapFilesRecursively(path.resolve(import.meta.dirname, 'templates'))
}

/** 全套测试只准备一次资产，不在 worker 中加载被 mock 的依赖解析模块。 */
export default async function setup() {
  await execa(process.execPath, ['--import', 'tsx', 'scripts/prepare-templates.ts'], {
    cwd: import.meta.dirname,
    stdio: 'inherit',
  })
  await prepareTemplateTypeScriptProjects()
}
