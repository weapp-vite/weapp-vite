import type { HmrRuntimeFallbackCode } from '../packages/weapp-vite/src/runtime/hmrRuntimeCapabilities'
import { describe, expect, it } from 'vitest'
import { createIssue1015HmrPublication, issue1015ExpectedMarkerMatches } from '../e2e/utils/issue1015HmrContract'
import { resolveStatefulHmrStartupFallback } from '../packages/weapp-vite/src/runtime/hmrRuntimeHostCapabilities'

const fallback = {
  from: 'stateful-experimental',
  to: 'classic',
  reason: 'ide-classic-handoff',
  message: '当前微信宿主在安装 stateful 资源前交接到 classic。',
  requested: 'stateful-experimental',
  actual: 'classic',
  phase: 'switching',
}
const ready = { reason: 'ide-classic-handoff', requested: 'stateful-experimental', actual: 'classic', phase: 'classic' }
const fallbackLog = (record = fallback) => `[weapp-vite] HMR fallback ${JSON.stringify(record)}\n`
const readyLog = (record = ready) => `[weapp-vite] HMR classic ready ${JSON.stringify(record)}\n`

function publication(output: string, runtime: 'classic' | 'stateful-experimental' = 'stateful-experimental') {
  const dev = { getOutput: () => output } as Parameters<typeof createIssue1015HmrPublication>[1]
  return createIssue1015HmrPublication('contract-fixture', dev, runtime, 'profile.jsonl')
}

describe('issue1015 startup and checkpoint contracts without an IDE', () => {
  it('accepts the required WeChat startup handoff before connecting a requested stateful runtime', () => {
    expect(resolveStatefulHmrStartupFallback({ platform: 'weapp', runtime: 'stateful-experimental' }))
      .toMatchObject({ code: 'ide-classic-handoff' })
    expect(publication(fallbackLog() + readyLog()).stateful).toBe(false)
  })

  it.each(['stylesheet-output', 'runtime-contract', 'entry-topology'] satisfies HmrRuntimeFallbackCode[])(
    'rejects %s as a substitute for the required startup handoff',
    (reason) => {
      const output = fallbackLog({ ...fallback, reason }) + readyLog({ ...ready, reason })
      expect(() => publication(output).stateful).toThrow()
    },
  )

  it.each([
    ['reason', 'stylesheet-output'],
    ['requested', 'auto'],
    ['phase', 'switching'],
  ])('rejects a classic ready event with inconsistent %s', (field, value) => {
    const output = fallbackLog() + readyLog({ ...ready, [field!]: value })
    expect(() => publication(output).stateful).toThrow()
  })

  it.each(['fallback', 'ready'])('rejects duplicate %s events', (event) => {
    const output = fallbackLog() + readyLog() + (event === 'fallback' ? fallbackLog() : readyLog())
    expect(() => publication(output).stateful).toThrow()
  })

  it('keeps an explicitly classic request classic without fabricating handoff events', () => {
    expect(publication('initial build complete\n', 'classic').stateful).toBe(false)
    expect(() => publication(fallbackLog() + readyLog(), 'classic').stateful).toThrow()
  })

  it.each(['classic', 'stateful-experimental'] as const)('preserves the initial App/Page identity for %s', (runtime) => {
    expect(issue1015ExpectedMarkerMatches(runtime, 'initial')).toEqual({ app: true, page: true })
  })

  it('requires new App/Page identities at all six edited checkpoints after a requested stateful startup', () => {
    for (const checkpoint of ['style-only', 'source-switch', 'replace-variable', 'remove-variable', 'restore-variable', 'reactive']) {
      expect(issue1015ExpectedMarkerMatches('stateful-experimental', checkpoint)).toEqual({ app: false, page: false })
    }
  })

  it('preserves the classic first stylesheet reload contract and its existing later checkpoint scope', () => {
    expect(issue1015ExpectedMarkerMatches('classic', 'style-only')).toEqual({ app: false, page: false })
    for (const checkpoint of ['source-switch', 'replace-variable', 'remove-variable', 'restore-variable', 'reactive']) {
      expect(issue1015ExpectedMarkerMatches('classic', checkpoint)).toBeUndefined()
    }
  })
})
