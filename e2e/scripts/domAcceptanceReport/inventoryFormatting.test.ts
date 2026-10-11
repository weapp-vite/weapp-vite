import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 回归使用真实 tsx 子进程验证 ESLint 的 ESM 加载及错误传播。
import { execa } from 'execa'
import { expect, it } from 'vitest'
import { ACCEPTANCE_ROOT } from './helpers'

async function formatInTsxProcess(markdown: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dom-inventory-format-'))
  try {
    const entry = path.join(root, 'format.mjs')
    const inventory = pathToFileURL(path.join(ACCEPTANCE_ROOT, 'e2e/scripts/domAcceptanceReport/inventory.ts')).href
    await fs.writeFile(entry, `import { formatDomAcceptanceInventory } from ${JSON.stringify(inventory)}\nprocess.stdout.write(await formatDomAcceptanceInventory(${JSON.stringify(markdown)}))\n`)
    // 同时覆盖显式 loader 和从父进程继承 loader 的正式脚本入口。
    return await execa(process.execPath, ['--import', 'tsx', entry], {
      cwd: ACCEPTANCE_ROOT,
      env: { NODE_OPTIONS: '--import tsx' },
      reject: false,
    })
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

it('formats Markdown with the real ESLint config in a tsx process', async () => {
  const { exitCode, stdout } = await formatInTsxProcess('# Inventory\n\n```js\nexport const message = "ready";\n```\n')
  expect(exitCode).toBe(0)
  expect(stdout).toContain('export const message = \'ready\'\n')
}, 30_000)

it('propagates unfixable Markdown code errors instead of accepting an unformatted report', async () => {
  const { exitCode, stderr } = await formatInTsxProcess('# Inventory\n\n```js\nconst = 1\n```\n')
  expect(exitCode).not.toBe(0)
  expect(stderr).toContain('DOM inventory Markdown formatting failed:')
  expect(stderr).toContain('Parsing error')
}, 30_000)
