import process from 'node:process'
import { readInstalledVite } from './helpers.mjs'
import { verifyHooks } from './hooks/index.mjs'
import { verifyOptimizer } from './optimizer.mjs'
import { verifyOptimizerCancel } from './optimizerCancel.mjs'
import { verifyOptimizerServer } from './optimizerServer.mjs'
import { verifyPollingOwners } from './polling.mjs'
import { verifyResolver } from './resolver.mjs'
import { parseViteContractCases, runViteContractCases, viteContractCases } from './runner.mjs'

const cases = parseViteContractCases(process.argv.slice(2))
const report = {
  suite: 'dependency-internals',
  status: 'running',
  planned: [...viteContractCases],
  selected: cases,
  selection: cases.length === viteContractCases.length ? 'complete' : 'selected',
  completed: [],
  checks: [],
}
try {
  const { source, version, sha256 } = await readInstalledVite()
  Object.assign(report, { vite: version, sha256 })
  const contracts = {
    'hooks': () => verifyHooks(source),
    'resolver': () => verifyResolver(source),
    'optimizer': () => verifyOptimizer(source),
    'optimizer-cancel': () => verifyOptimizerCancel(source),
    'optimizer-server': () => verifyOptimizerServer(),
    'polling': () => verifyPollingOwners(),
  }
  report.checks = await runViteContractCases(cases, Object.fromEntries(Object.entries(contracts).map(([name, verify]) => [name, async () => {
    report.currentContract = name
    const checks = await verify()
    report.completed.push(name)
    delete report.currentContract
    return checks
  }])))
  report.status = 'passed'
}
catch (error) {
  report.status = 'failed'
  report.failed = report.currentContract
  report.notExecuted = cases.slice(report.completed.length + (report.failed ? 1 : 0))
  report.error = { message: String(error), stack: error?.stack, actual: error?.actual, expected: error?.expected }
  process.exitCode = 1
  console.error(error)
}
console.log(JSON.stringify(report))
