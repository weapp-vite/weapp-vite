import { appendFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { needsSmoke } from './contract.mjs'
import { pages, request } from './github.mjs'

/** 在当前 PR 仍与调度时冻结的提交一致时解析冒烟范围。 */
export async function selectSmokeScope({ prNumber, headSha, baseSha }, get = request) {
  const pull = await get(`/pulls/${prNumber}`)
  if (pull.state !== 'open' || pull.head.sha !== headSha || pull.base.sha !== baseSha) {
    throw new Error('PR changed after dispatch; start a new validation')
  }
  const files = await pages(`/pulls/${prNumber}/files`, get)
  const fresh = await get(`/pulls/${prNumber}`)
  if (fresh.state !== 'open' || fresh.head.sha !== headSha || fresh.base.sha !== baseSha) {
    throw new Error('PR changed while selecting smoke paths; start a new validation')
  }
  return files.length >= 3000 || needsSmoke(files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)))
}

async function main() {
  const needed = await selectSmokeScope({ prNumber: process.env.PERFORMANCE_PR_NUMBER, headSha: process.env.PERFORMANCE_HEAD_SHA, baseSha: process.env.PERFORMANCE_BASE_SHA })
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
