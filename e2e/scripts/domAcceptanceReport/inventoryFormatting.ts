import type { ESLint } from 'eslint'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 使用跨平台子进程及 stdin 隔离 ESLint 与 tsx 的加载边界。
import { execa } from 'execa'

export async function formatDomAcceptanceInventory(markdown: string, root = path.resolve(import.meta.dirname, '../../..')) {
  // ESLint 使用原生 Node 加载配置，避免父进程 tsx 将其 ESM 依赖转为 CJS。
  const cli = fileURLToPath(new URL('./bin/eslint.js', import.meta.resolve('eslint/package.json')))
  // 使用非忽略的虚拟文件名应用 Markdown 规则；生成报告本身不参与 Git 或 lint 扫描。
  const { stdout, stderr, exitCode } = await execa(process.execPath, [
    cli,
    '--stdin',
    '--stdin-filename',
    path.join(root, 'e2e/dom-acceptance-report.md'),
    '--fix-dry-run',
    '--format',
    'json',
  ], { cwd: root, input: markdown, reject: false, env: { NODE_OPTIONS: undefined } })
  const [result] = (stdout ? JSON.parse(stdout) : []) as ESLint.LintResult[]
  if (exitCode !== 0 || !result || result.errorCount) {
    throw new Error(`DOM inventory Markdown formatting failed: ${stderr || result?.messages.map(message => message.message).join('; ') || 'missing ESLint result'}`)
  }
  return result.output ?? markdown
}
