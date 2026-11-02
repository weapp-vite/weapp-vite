import type { ProductContractResult } from './support'
import { hooks, resolver } from './build'
import { miniOptimizer, webOptimizer } from './lifecycle'
import { polling, ready } from './watch'

const contracts = [
  ['hooks', hooks],
  ['resolver', resolver],
  ['mini-optimizer', miniOptimizer],
  ['web-optimizer', webOptimizer],
  ['polling', polling],
  ['ready', ready],
] as const

async function executeContracts(plan: readonly (typeof contracts[number])[], onComplete?: (result: ProductContractResult) => void, onStart?: (name: string) => void): Promise<ProductContractResult[]> {
  const results: ProductContractResult[] = []
  for (const [name, verify] of plan) {
    onStart?.(name)
    const result: ProductContractResult = { name, status: 'passed', observations: await verify() }
    results.push(result)
    onComplete?.(result)
  }
  return results
}

/** 完整公开产品诊断始终执行六项，保留 Web 关闭残留的原始失败。 */
export function verifyViteProductContracts(onComplete?: (result: ProductContractResult) => void, onStart?: (name: string) => void): Promise<ProductContractResult[]> {
  return executeContracts(contracts, onComplete, onStart)
}

/** 固定五项必需验收；版本核验和豁免说明由正式入口负责。 */
export function verifyViteProductAcceptance(onComplete?: (result: ProductContractResult) => void, onStart?: (name: string) => void): Promise<ProductContractResult[]> {
  return executeContracts(contracts.filter(([name]) => name !== 'web-optimizer'), onComplete, onStart)
}
