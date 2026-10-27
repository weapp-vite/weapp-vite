import assert from 'node:assert/strict'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { DOCUMENT_CONTRACTS, isRootPolicyDocument } from '../../scripts/verification/documentPolicy.mjs'

async function execute(command, args) {
  // eslint-disable-next-line e18e/ban-dependencies -- pnpm 命令解析由跨平台进程包装器负责；空删除范围不加载依赖。
  const { execa } = await import('execa')
  await execa(command, args, { stdio: 'inherit' })
}

/** 文档 lint 和适用生成契约共用冻结输入，空删除范围不启动 ESLint。 */
export async function verifyFrozenDocumentation(paths, checks, run = execute) {
  assert(Array.isArray(paths) && paths.every(isRootPolicyDocument), 'Invalid frozen documentation paths')
  assert(Array.isArray(checks) && checks.every(check => Object.hasOwn(DOCUMENT_CONTRACTS, check))
    && new Set(checks).size === checks.length, 'Invalid frozen documentation checks')
  if (paths.length > 0) {
    await run(process.execPath, ['node_modules/eslint/bin/eslint.js', ...paths])
  }
  for (const check of checks) {
    await run('pnpm', ['run', DOCUMENT_CONTRACTS[check]])
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyFrozenDocumentation(JSON.parse(process.env.PR_DOCUMENTATION_PATHS), JSON.parse(process.env.PR_DOCUMENTATION_CHECKS)).catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
