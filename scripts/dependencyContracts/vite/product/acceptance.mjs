import assert from 'node:assert/strict'
import { viteProductContractNames, viteRequiredContractNames } from './inventory.mjs'

/** 固定版本的临时验收例外；升级后必须显式重新评审，不能自动继承。 */
export function applyViteAcceptancePolicy(report, versions) {
  assert.deepEqual(versions, { vite: '8.3.5', rolldown: '1.2.16' }, 'Review or remove the Vite acceptance waivers before changing compiler versions')
  assert.deepEqual(report.planned, [...viteRequiredContractNames])
  Object.assign(report, versions, {
    fullInventory: [...viteProductContractNames],
    waived: [{
      name: 'web-optimizer',
      reason: 'Scanner close can leave deps_temp cache work; unresolved and accepted for this fixed compiler pair',
      versions: { ...versions },
      introducedBy: 'PR #1294',
      documentation: 'patches/compiler-memory.md',
    }],
  })
  finalizeViteAcceptanceReport(report)
}

/** 只补充验收说明，不改变失败、超时、清理状态或实际完成项。 */
export function finalizeViteAcceptanceReport(report) {
  if (!report.waived) {
    return
  }
  report.assessment = report.status === 'passed' ? 'accepted-with-waivers' : 'incomplete-with-waivers'
  report.notExecuted = viteProductContractNames.filter(name => !report.completed.includes(name) && name !== report.failed)
}
