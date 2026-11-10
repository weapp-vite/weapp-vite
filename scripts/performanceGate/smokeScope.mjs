import { appendFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { isNativePrContext } from '../../.github/scripts/native-pr-refresh.mjs'
import { readNativeSnapshotFiles } from '../../.github/scripts/native-pr-snapshot.mjs'
import { needsSmoke } from './contract.mjs'
import { pages, request } from './github.mjs'
import { readFrozenPrTarget } from './prTarget.mjs'

/** 原生冒烟范围来自不可变快照，手动诊断保留当前 PR 文件列表。 */
export async function selectSmokeScope(context, get = request) {
  await readFrozenPrTarget(context, get)
  const snapshot = isNativePrContext(context) ? await readNativeSnapshotFiles(context, get) : null
  const files = snapshot?.files ?? await pages(`/pulls/${context.prNumber}/files`, get)
  await readFrozenPrTarget(context, get, 'PR changed while selecting smoke paths; start a new validation')
  return snapshot?.truncated || files.length >= 3000 || needsSmoke(files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)))
}

async function main() {
  const needed = await selectSmokeScope(JSON.parse(process.env.PERFORMANCE_PR_CONTEXT))
  await appendFile(process.env.GITHUB_OUTPUT, `needed=${needed}\n`)
  if (!needed) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, 'Performance Smoke：仅无关路径变更，无需冒烟；完整性能验收未运行。\n')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
