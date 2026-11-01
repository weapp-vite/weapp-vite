import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '../../../../packages/devtools-runtime/src/lease/machine.ts'
import { getPendingProductFixtures } from '../../../../packages/weapp-vite/scripts/viteProductContracts/support.ts'
import { completeProductReport, createProductReport, failProductReport, parseProductArguments, recordProductResult } from '../../report.mjs'
import { viteProductContractNames } from './inventory.mjs'
import { ViteProductTerminationError, withViteProductOwnership } from './ownership.mjs'

const { reportFile } = parseProductArguments(process.argv.slice(2))
const report = createProductReport('vite', viteProductContractNames)
await mkdir(path.dirname(reportFile), { recursive: true })
const persist = () => writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`)
try {
  const require = createRequire(import.meta.url)
  const manifest = JSON.parse(await readFile(require.resolve('vite/package.json'), 'utf8'))
  assert.equal(manifest.name, 'vite')
  assert.equal(typeof manifest.version, 'string')
  report.vite = manifest.version
  await withMachineE2ELease(lease => withViteProductOwnership(lease, {
    reportFile,
    report,
    pendingFixtures: getPendingProductFixtures,
    persist,
    async execute() {
      const { verifyViteProductContracts } = await import('../../../../packages/weapp-vite/scripts/viteProductContracts/index.ts')
      const results = await verifyViteProductContracts((result) => {
        recordProductResult(report, result)
        writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`)
      }, (name) => {
        report.currentContract = name
      })
      assert.ok(Array.isArray(results), 'The Vite product entry must return observed case results')
      assert.deepEqual(results, report.results, 'The final Vite results must match its completed observations')
    },
  }))
  Object.assign(report, completeProductReport(report, viteProductContractNames))
}
catch (error) {
  if (!(error instanceof ViteProductTerminationError)) {
    Object.assign(report, failProductReport(report, error))
  }
  process.exitCode = 1
  console.error(error)
}
finally {
  report.finishedAt = new Date().toISOString()
  await persist()
  console.log(JSON.stringify(report))
}
