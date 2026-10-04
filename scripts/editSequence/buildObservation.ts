import { deepStrictEqual, ok } from 'node:assert/strict'

/** 有效输入和资源采样必须成功发布，不能以两侧相同错误替代构建成功。 */
export function assertSuccessfulSequenceBuild(observation: unknown): void {
  ok(observation && typeof observation === 'object', 'Missing build observation')
  const value = observation as { diagnostics?: unknown, published?: unknown }
  deepStrictEqual(value.diagnostics, [], 'Expected a successful sequence build')
  ok(value.published && typeof value.published === 'object', 'Missing published runtime observation')
}
