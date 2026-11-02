import type { TestContext } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 回归使用真实 tsx 子进程验证 ESLint 的 ESM 加载及错误传播。
import { execa } from 'execa'
import { expect, it } from 'vitest'
import { ACCEPTANCE_ROOT } from './helpers'

async function runFormattingProcess(markdown: string, signal: AbortSignal) {
  const started = performance.now()
  const trace = (phase: string) => process.stderr.write(`[dom-inventory-format] ${phase} elapsedMs=${Math.round(performance.now() - started)}\n`)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dom-inventory-format-'))
  trace('temporary-directory-created')
  try {
    const entry = path.join(root, 'format.mjs')
    const formatter = pathToFileURL(path.join(ACCEPTANCE_ROOT, 'e2e/scripts/domAcceptanceReport/inventoryFormatting.ts')).href
    // formatter 的 ESM 边界独立于清单 AST；完整 inventory CLI 仍由正式清单任务覆盖。
    await fs.writeFile(entry, `
const started = performance.now()
const trace = phase => process.stderr.write('[dom-inventory-format] ' + phase + ' childElapsedMs=' + Math.round(performance.now() - started) + '\\n')
trace('before-formatter-import')
const { formatDomAcceptanceInventory } = await import(${JSON.stringify(formatter)})
trace('after-formatter-import')
trace('before-eslint-format')
process.stdout.write(await formatDomAcceptanceInventory(${JSON.stringify(markdown)}))
trace('after-eslint-format')
`)
    trace('entry-written')
    signal.throwIfAborted()
    // 同时覆盖显式 loader 和从父进程继承 loader 的正式脚本入口。
    const execution = execa(process.execPath, ['--import', 'tsx', entry], {
      cwd: ACCEPTANCE_ROOT,
      env: { NODE_OPTIONS: '--import tsx' },
      reject: false,
      cancelSignal: signal,
      killDescendants: true,
    })
    const child = execution.nodeChildProcess
    child.once('spawn', () => trace(`spawn pid=${child.pid}`))
    child.once('exit', (code, exitSignal) => trace(`exit pid=${child.pid} code=${code} signal=${exitSignal}`))
    const closed = new Promise<void>((resolve) => {
      child.once('close', (code, exitSignal) => {
        trace(`close pid=${child.pid} code=${code} signal=${exitSignal}`)
        resolve()
      })
    })
    let forwarded = 0
    child.stderr?.on('data', (chunk) => {
      const remaining = 4096 - forwarded
      if (remaining > 0) {
        const text = String(chunk).slice(0, remaining)
        forwarded += text.length
        process.stderr.write(text)
      }
    })
    try {
      return await execution
    }
    finally {
      // 超时取消也必须等精确 child 的 close，才能删除其工作目录并进入下一 case。
      await closed
    }
  }
  finally {
    trace('cleanup-started')
    await fs.rm(root, { recursive: true, force: true })
    trace('cleanup-completed')
  }
}

function formatInTsxProcess(markdown: string, context: TestContext) {
  const execution = runFormattingProcess(markdown, context.signal)
  context.onTestFinished(async () => {
    await execution
  })
  return execution
}

it('formats Markdown with the real ESLint config in a tsx process', async (context) => {
  const { exitCode, stdout } = await formatInTsxProcess('# Inventory\n\n```js\nexport const message = "ready";\n```\n', context)
  expect(exitCode).toBe(0)
  expect(stdout).toContain('export const message = \'ready\'\n')
}, 30_000)

it('propagates unfixable Markdown code errors instead of accepting an unformatted report', async (context) => {
  const { exitCode, stderr } = await formatInTsxProcess('# Inventory\n\n```js\nconst = 1\n```\n', context)
  expect(exitCode).not.toBe(0)
  expect(stderr).toContain('DOM inventory Markdown formatting failed:')
  expect(stderr).toContain('Parsing error')
}, 30_000)
