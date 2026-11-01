import type { ProductContractResult } from './support'
import { hooks, resolver } from './build'
import { miniOptimizer, webOptimizer } from './lifecycle'
import { polling, ready } from './watch'

/** 普通安装实际执行的产品路径；成功项由完整公开操作结算后记录。 */
export async function verifyViteProductContracts(onComplete?: (result: ProductContractResult) => void, onStart?: (name: string) => void): Promise<ProductContractResult[]> {
  const results: ProductContractResult[] = []
  for (const [name, verify] of [
    ['hooks', hooks],
    ['resolver', resolver],
    ['mini-optimizer', miniOptimizer],
    ['web-optimizer', webOptimizer],
    ['polling', polling],
    ['ready', ready],
  ] as const) {
    onStart?.(name)
    const result: ProductContractResult = { name, status: 'passed', observations: await verify() }
    results.push(result)
    onComplete?.(result)
  }
  return results
}
