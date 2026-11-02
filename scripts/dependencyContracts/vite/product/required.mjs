import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '../../../../packages/devtools-runtime/src/lease/machine.ts'
import { getPendingProductFixtures } from '../../../../packages/weapp-vite/scripts/viteProductContracts/support.ts'
import { completeProductReport, createProductReport, failProductReport, parseProductArguments, recordProductResult } from '../../report.mjs'
import { applyViteAcceptancePolicy, finalizeViteAcceptanceReport } from './acceptance.mjs'
import { viteRequiredContractNames } from './inventory.mjs'
import { ViteProductTerminationError, withViteProductOwnership } from './ownership.mjs'

const { reportFile } = parseProductArguments(process.argv.slice(2))
const report = createProductReport('vite', viteRequiredContractNames)
await mkdir(path.dirname(reportFile), { recursive: true })
function serialize() {
  finalizeViteAcceptanceReport(report)
  return `${JSON.stringify(report, null, 2)}\n`
}
const persist = () => writeFile(reportFile, serialize())
try {
  // 从被测产品模块解析，不能由根目录的另一份 peer 版本继承豁免。
  const require = createRequire(new URL('../../../../packages/weapp-vite/scripts/viteProductContracts/index.ts', import.meta.url))
  const viteManifestFile = require.resolve('vite/package.json')
  const vite = JSON.parse(await readFile(viteManifestFile, 'utf8'))
  const rolldown = JSON.parse(await readFile(createRequire(viteManifestFile).resolve('rolldown/package.json'), 'utf8'))
  assert.equal(vite.name, 'vite')
  assert.equal(rolldown.name, 'rolldown')
  report.vite = vite.version
  report.rolldown = rolldown.version
  applyViteAcceptancePolicy(report, { vite: vite.version, rolldown: rolldown.version })
  await withMachineE2ELease(lease => withViteProductOwnership(lease, {
    reportFile,
    report,
    pendingFixtures: getPendingProductFixtures,
    persist,
    async execute() {
      const { verifyViteProductAcceptance } = await import('../../../../packages/weapp-vite/scripts/viteProductContracts/index.ts')
      const results = await verifyViteProductAcceptance((result) => {
        recordProductResult(report, result)
        writeFileSync(reportFile, serialize())
      }, (name) => {
        report.currentContract = name
      })
      assert.deepEqual(results, report.results, 'The final Vite results must match its completed observations')
    },
  }))
  Object.assign(report, completeProductReport(report, viteRequiredContractNames))
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
