import process from 'node:process'
import { getSuiteTasks, listE2ESuites } from './e2e-suite-manifest'
import { runTaskSuite } from './suiteRunner'

const mode = process.argv[2] ?? 'full'

if (mode === 'list') {
  const suites = listE2ESuites()
  for (const suite of suites) {
    console.log(`${suite.name} (${suite.taskCount})`)
    console.log(`  ${suite.description}`)
  }
  process.exit(0)
}

const tasks = getSuiteTasks(mode)

if (tasks.length === 0) {
  console.error(`Unknown e2e suite: ${mode}`)
  console.error(`Available suites: ${listE2ESuites().map(suite => suite.name).join(', ')}, list`)
  process.exitCode = 1
}
else {
  await runTaskSuite(`e2e:${mode}`, tasks)
}
