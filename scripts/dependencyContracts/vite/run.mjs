import process from 'node:process'
import { readInstalledVite } from './helpers.mjs'
import { verifyHooks } from './hooks/index.mjs'
import { verifyOptimizer } from './optimizer.mjs'
import { verifyOptimizerCancel } from './optimizerCancel.mjs'
import { verifyOptimizerServer } from './optimizerServer.mjs'
import { verifyPollingOwners } from './polling.mjs'
import { verifyResolver } from './resolver.mjs'
import { parseViteContractCases, runViteContractCases } from './runner.mjs'

const cases = parseViteContractCases(process.argv.slice(2))
const { source, version, sha256 } = await readInstalledVite()
const checks = await runViteContractCases(cases, {
  'hooks': () => verifyHooks(source),
  'resolver': () => verifyResolver(source),
  'optimizer': () => verifyOptimizer(source),
  'optimizer-cancel': () => verifyOptimizerCancel(source),
  'optimizer-server': () => verifyOptimizerServer(),
  'polling': () => verifyPollingOwners(),
})
console.log(JSON.stringify({ status: 'passed', vite: version, sha256, cases, checks }))
