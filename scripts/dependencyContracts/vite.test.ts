import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 公开产品契约复用跨平台子进程超时与原始错误传播。
import { execa } from 'execa'
import { expect, it } from 'vitest'
import { viteProductContractNames } from './vite/product/inventory.mjs'
import { viteProductTimeoutMs } from './vite/product/ownership.mjs'

it('preserves the complete Vite product lifecycle through the public weapp host', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vite-product-report-'))
  let complete = false
  try {
    const script = fileURLToPath(new URL('./vite/product/run.mjs', import.meta.url))
    const supervisor = fileURLToPath(new URL('../../e2e/scripts/run-e2e-commands.ts', import.meta.url))
    const reportFile = path.join(directory, 'report.json')
    // 子入口先记录 scope 与完整预算；外层仅在监督失效时兜底，失败报告始终保留。
    await execa(process.execPath, ['--import', 'tsx', supervisor, process.execPath, '--import', 'tsx', script, '--report', reportFile], { timeout: viteProductTimeoutMs + 60_000 })
    const report = JSON.parse(await readFile(reportFile, 'utf8')) as { suite: string, status: string, vite: string, planned: string[], completed: string[], cleanup?: { status: string } }
    expect(report.suite).toBe('product-lifecycle')
    expect(report.status).toBe('passed')
    expect(report.vite).not.toBe('')
    expect(report.planned).toEqual(viteProductContractNames)
    expect(report.completed).toEqual(viteProductContractNames)
    expect(report.cleanup?.status).toBe('confirmed')
    complete = true
  }
  finally {
    if (complete) {
      await rm(directory, { recursive: true, force: true })
    }
  }
}, viteProductTimeoutMs + 90_000)
