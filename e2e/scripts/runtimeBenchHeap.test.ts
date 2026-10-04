import { afterEach, describe, expect, it, vi } from 'vitest'
import { readBenchHostHeap } from './runtimeBench/heap'
import { measureUpdate } from './runtimeBench/update'

afterEach(() => vi.useRealTimers())

describe('runtime benchmark host heap', () => {
  it('never presents headless memory as DevTools heap or probes its host', async () => {
    const host = { getAppServiceHeapUsage: vi.fn(), toolInfo: vi.fn() }
    expect(await readBenchHostHeap(host, 'headless')).toEqual({ provider: 'headless', toolVersion: null, sdkVersion: null, usage: { status: 'unsupported', source: null, reason: 'not-devtools' } })
    expect(host.getAppServiceHeapUsage).not.toHaveBeenCalled()
    expect(host.toolInfo).not.toHaveBeenCalled()
  })

  it('preserves host versions and explicit unsupported reasons without replacing them with worker RSS', async () => {
    const host = {
      toolInfo: vi.fn().mockResolvedValue({ version: 'test-ide', SDKVersion: 'test-sdk', unrelated: 'discard' }),
      getAppServiceHeapUsage: vi.fn().mockResolvedValue({ status: 'unsupported', source: 'appservice-cdp-runtime', reason: 'protocol-unimplemented' }),
    }
    expect(await readBenchHostHeap(host, 'devtools')).toEqual({ provider: 'devtools', toolVersion: 'test-ide', sdkVersion: 'test-sdk', usage: { status: 'unsupported', source: 'appservice-cdp-runtime', reason: 'protocol-unimplemented' } })
  })

  it('fails on missing APIs and propagates transport failures', async () => {
    await expect(readBenchHostHeap({}, 'devtools')).rejects.toThrow('requires the automator')
    const failure = new Error('transport timeout')
    await expect(readBenchHostHeap({
      toolInfo: async () => ({}),
      getAppServiceHeapUsage: async () => {
        throw failure
      },
    }, 'devtools')).rejects.toBe(failure)
  })

  it('samples before/after outside the workload timer and retains each sample independently', async () => {
    vi.useFakeTimers()
    let clock = 0
    let usedSize = 40
    const order: string[] = []
    const page = {
      waitFor: vi.fn(),
      callMethod: vi.fn(async () => {
        order.push('workload')
        clock += 17
        vi.setSystemTime(clock)
        usedSize += 2
        return { metrics: { singleCommitMs: 17 } }
      }),
    }
    const host = {
      reLaunch: async () => page,
      toolInfo: async () => ({ version: 'test-ide', SDKVersion: 'test-sdk' }),
      getAppServiceHeapUsage: async () => {
        order.push('heap')
        clock += 1_000
        vi.setSystemTime(clock)
        return { status: 'available' as const, source: 'appservice-cdp-runtime' as const, usedSize, totalSize: 100 }
      },
    }
    const result = await measureUpdate({
      session: { run: async (_label, operation) => operation(host), close: async () => {} },
      route: '/pages/update/index',
      method: 'runSingleCommitBench',
      rounds: 1,
      sampleCount: 2,
      requirePhases: false,
      provider: 'devtools',
      log: () => {},
    })
    expect(order).toEqual(['heap', 'workload', 'heap', 'heap', 'workload', 'heap', 'heap', 'workload', 'heap'])
    expect(result.samples?.map(sample => sample.wallMs)).toEqual([17, 17])
    expect(result.samples?.[0]?.memory).toMatchObject({ workerRssBefore: expect.any(Number), workerRssAfter: expect.any(Number), hostHeapBytes: 44, hostHeapCapability: 'available', hostHeapBefore: { usage: { usedSize: 42 } }, hostHeapAfter: { usage: { usedSize: 44 } } })
    expect(result.samples?.[1]?.memory).toMatchObject({ hostHeapBefore: { usage: { usedSize: 44 } }, hostHeapAfter: { usage: { usedSize: 46 } } })
  })
})
