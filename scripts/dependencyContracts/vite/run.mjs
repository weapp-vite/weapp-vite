import { readInstalledVite } from './helpers.mjs'
import { verifyHooks } from './hooks/index.mjs'
import { verifyResolver } from './resolver.mjs'

const { source, version, sha256 } = await readInstalledVite()
const checks = [
  ...await verifyHooks(source),
  ...await verifyResolver(source),
]
console.log(JSON.stringify({ status: 'passed', vite: version, sha256, checks }))
