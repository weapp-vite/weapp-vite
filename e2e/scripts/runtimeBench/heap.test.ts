import type { BenchHeapSampleContext, NativeInspectorHeapReader } from './nativeInspectorHeap/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readBenchHostHeap } from './heap'
import { heapContext, testInspectorIdentity, testNativeEvidence } from './nativeInspectorHeap/testHelpers'
import { measureUpdate } from './update'

afterEach(() => vi.useRealTimers())

describe('private native Inspector benchmark heap wiring', () => {
  it('keeps the default automator path and does not use native Inspector for headless', async () => {
    const host = {
      toolInfo: vi.fn().mockResolvedValue({ version: 'test-ide', SDKVersion: 'test-sdk' }),
      getAppServiceHeapUsage: vi.fn().mockResolvedValue({ status: 'unsupported', source: 'appservice-cdp-runtime', reason: 'protocol-unimplemented' }),
    }
    const collector = { identity: testInspectorIdentity(), read: vi.fn() }
    expect((await readBenchHostHeap(host, 'devtools')).usage).toMatchObject({ status: 'unsupported', reason: 'protocol-unimplemented' })
    expect(host.getAppServiceHeapUsage).toHaveBeenCalledExactlyOnceWith({ timeout: 2_500 })
    expect((await readBenchHostHeap(host, 'headless', { collector, context: heapContext })).usage).toMatchObject({ reason: 'not-devtools' })
    expect(collector.read).not.toHaveBeenCalled()
    expect(host.toolInfo).toHaveBeenCalledTimes(1)
  })

  it('requires the approved actual host version and maps only validated raw native bytes', async () => {
    const identity = testInspectorIdentity()
    const evidence = testNativeEvidence(identity, heapContext)
    const collector = { identity, read: vi.fn().mockResolvedValue(evidence) }
    const host = { toolInfo: vi.fn().mockResolvedValue({ version: 'test-ide', SDKVersion: 'test-sdk' }) }
    expect(await readBenchHostHeap(host, 'devtools', { collector, context: heapContext })).toMatchObject({
      toolVersion: 'test-ide',
      sdkVersion: 'test-sdk',
      native: evidence,
      usage: { status: 'available', source: 'appservice-cdp-runtime', usedSize: 12, totalSize: 24 },
    })
    host.toolInfo.mockResolvedValueOnce({ version: 'test-ide', SDKVersion: 'another-sdk' })
    await expect(readBenchHostHeap(host, 'devtools', { collector, context: heapContext })).rejects.toThrow('approved target')
    expect(collector.read).toHaveBeenCalledTimes(1)
    collector.read.mockResolvedValueOnce({ ...evidence, sessionId: 'another-session' })
    await expect(readBenchHostHeap(host, 'devtools', { collector, context: heapContext })).rejects.toThrow('another session')
    collector.read.mockResolvedValueOnce({ ...evidence, context: { ...evidence.context, phase: 'after' } })
    await expect(readBenchHostHeap(host, 'devtools', { collector, context: heapContext })).rejects.toThrow('another benchmark checkpoint')
  })

  it('preserves the original warmup/sample sequence and excludes both native probes from workload time', async () => {
    let clock = Date.now()
    vi.useFakeTimers()
    vi.setSystemTime(clock)
    const order: string[] = []
    const contexts: BenchHeapSampleContext[] = []
    const identity = testInspectorIdentity()
    const collector: NativeInspectorHeapReader = {
      identity,
      async read(context) {
        contexts.push(context)
        order.push(context.phase)
        const requestedAt = new Date().toISOString()
        clock += 1_000
        vi.setSystemTime(clock)
        const evidence = testNativeEvidence(identity, context, contexts.length)
        return { ...evidence, requestedAt, elapsedMs: 1_000, raw: { ...evidence.raw, startedAt: requestedAt, sentAt: requestedAt, durationMs: 1_000 } }
      },
    }
    const page = {
      waitFor: vi.fn(),
      callMethod: vi.fn(async (..._args: unknown[]) => {
        order.push('workload')
        clock += 17
        vi.setSystemTime(clock)
        return { metrics: { singleCommitMs: 17 } }
      }),
    }
    const host = { reLaunch: async () => page, toolInfo: async () => ({ version: 'test-ide', SDKVersion: 'test-sdk' }) }
    const result = await measureUpdate({
      session: { run: async (_label, operation) => operation(host), close: async () => {} },
      route: heapContext.route,
      method: 'runSingleCommitBench',
      rounds: 180,
      sampleCount: 2,
      requirePhases: false,
      provider: 'devtools',
      nativeHeap: { collector, preset: heapContext.preset, scenario: heapContext.scenario },
      log: () => {},
    })
    expect(order).toEqual(['before', 'workload', 'after', 'before', 'workload', 'after', 'before', 'workload', 'after'])
    expect(contexts.map(context => [context.sampleIndex, context.phase])).toEqual([[-1, 'before'], [-1, 'after'], [0, 'before'], [0, 'after'], [1, 'before'], [1, 'after']])
    expect(result.samples?.map(sample => sample.wallMs)).toEqual([17, 17])
    expect(result.samples?.map(sample => sample.memory?.hostHeapBefore.native?.sequence)).toEqual([3, 5])
    expect(page.callMethod.mock.calls.map(call => call.slice(1))).toEqual([[180], [180], [180]])
  })
})
