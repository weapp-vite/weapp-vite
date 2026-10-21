import { readInstalledVite } from './helpers.mjs'
import { verifyHooks } from './hooks/index.mjs'
import { verifyOptimizer } from './optimizer.mjs'
import { verifyOptimizerCancel } from './optimizerCancel.mjs'
import { verifyOptimizerServer } from './optimizerServer.mjs'
import { verifyPollingOwners } from './polling.mjs'
import { verifyResolver } from './resolver.mjs'

const { source, version, sha256 } = await readInstalledVite()
const checks = [
  ...await verifyHooks(source),
  ...await verifyResolver(source),
  ...await verifyOptimizer(source),
  ...await verifyOptimizerCancel(source),
  ...await verifyOptimizerServer(),
  ...await verifyPollingOwners(),
]
console.log(JSON.stringify({ status: 'passed', vite: version, sha256, checks }))
