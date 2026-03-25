import process from 'node:process'
import { getSuiteTasks } from './e2e-suite-manifest'
import { runTaskSuite } from './suiteRunner'

const mode = process.argv[2] ?? 'full'
const tasks = getSuiteTasks(mode)

if (tasks.length === 0) {
  console.error(`Unknown e2e suite: ${mode}`)
  process.exitCode = 1
}
else {
  await runTaskSuite(`e2e:${mode}`, tasks)
}
