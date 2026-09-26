import type { HostLifecycleEvidence } from '../../e2e-apps/shared/appLifecycle/observer'
import { expect } from 'vitest'
import { APP_HOOKS } from '../../e2e-apps/shared/appLifecycle/observer'

/** 每次 hook 必须对应同 fixture 的真实宿主回调，参数快照与对象身份都不能变化。 */
export function assertHostLifecycleForwarding(evidence: HostLifecycleEvidence, logs: Array<{ hook: string, skipped?: boolean }>) {
  expect(evidence.host.length, 'must capture the cold host input').toBeGreaterThan(0)
  expect(evidence.host.filter(entry => entry.hook === 'onLaunch'), 'must retain exactly one cold launch').toHaveLength(1)
  const observed = logs.filter(entry => !entry.skipped)
  expect(evidence.hooks.map(entry => entry.hook)).toEqual(observed.map(entry => entry.hook))
  expect(evidence.hooks).toHaveLength(evidence.host.length)
  for (const [index, host] of evidence.host.entries()) {
    const hook = evidence.hooks[index]!
    expect(APP_HOOKS).toContain(host.hook)
    expect(hook.hostId, `${host.hook}: host invocation identity`).toBe(host.id)
    expect(hook.hook).toBe(host.hook)
    expect(hook.sameArguments, `${host.hook}: original argument identities`).toBe(true)
    expect(hook.args, `${host.hook}: complete arguments including path, query and scene`).toBe(host.args)
  }
}

/** 参数已在各自宿主边界完整验证，跨 fixture 仅比较共同的 hook 顺序与状态转移。 */
export function lifecycleStructure(entries: Array<Record<string, unknown>>) {
  return entries.map(({ hook, order, skipped, snapshot }) => ({ hook, order, skipped, snapshot }))
}
