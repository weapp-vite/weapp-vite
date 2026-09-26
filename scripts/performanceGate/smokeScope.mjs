import { appendFile, readFile } from 'node:fs/promises'
import process from 'node:process'
import { needsSmoke } from './contract.mjs'
import { pages } from './github.mjs'

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))
const files = await pages(`/pulls/${event.pull_request.number}/files`)
const needed = files.length >= 3000 || needsSmoke(files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)))
await appendFile(process.env.GITHUB_OUTPUT, `needed=${needed}\n`)
if (!needed) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, 'Performance Smoke：仅无关路径变更，无需冒烟；完整性能验收未运行。\n')
}
