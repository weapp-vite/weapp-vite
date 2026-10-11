import type { AppServiceHeapUsage, AppServiceHeapUsageOptions } from '@weapp-vite/miniprogram-automator'
import type { BenchHeapSampleContext, NativeInspectorHeapEvidence, NativeInspectorHeapReader } from './nativeInspectorHeap/protocol'
import { validateNativeInspectorHeapEvidence } from './nativeInspectorHeap/protocol'

export interface BenchHeapHost {
  getAppServiceHeapUsage?: (options?: AppServiceHeapUsageOptions) => Promise<AppServiceHeapUsage>
  toolInfo?: () => Promise<unknown>
}

export interface BenchHostHeapSnapshot {
  provider: string
  toolVersion: string | null
  sdkVersion: string | null
  usage: AppServiceHeapUsage | { status: 'unsupported', source: null, reason: 'not-devtools' }
  native?: NativeInspectorHeapEvidence
}

/** 只在真实 DevTools 连接上读宿主堆；元数据与堆请求均放在工作负载计时之外。 */
export async function readBenchHostHeap(host: BenchHeapHost, provider: string, native?: {
  collector: NativeInspectorHeapReader
  context: BenchHeapSampleContext
}): Promise<BenchHostHeapSnapshot> {
  if (provider !== 'devtools') {
    return { provider, toolVersion: null, sdkVersion: null, usage: { status: 'unsupported', source: null, reason: 'not-devtools' } }
  }
  if ((!native && !host.getAppServiceHeapUsage) || !host.toolInfo) {
    throw new Error('DevTools benchmark requires the automator AppService heap API and toolInfo')
  }
  const info = await host.toolInfo()
  const metadata = info !== null && typeof info === 'object' ? info as Record<string, unknown> : {}
  const version = (value: unknown) => typeof value === 'string' && value.trim() ? value : null
  const toolVersion = version(metadata.version)
  const sdkVersion = version(metadata.SDKVersion)
  if (native) {
    if (toolVersion !== native.collector.identity.toolVersion || sdkVersion !== native.collector.identity.sdkVersion) {
      throw new Error('Native Inspector benchmark host version differs from the approved target')
    }
    const evidence = await native.collector.read(native.context)
    validateNativeInspectorHeapEvidence(evidence)
    if (evidence.sessionId !== native.collector.identity.sessionId || evidence.raw.targetUrl !== native.collector.identity.targetUrl) {
      throw new Error('Native Inspector heap response belongs to another session or AppService target')
    }
    if (evidence.context.preset !== native.context.preset || evidence.context.scenario !== native.context.scenario
      || evidence.context.sampleIndex !== native.context.sampleIndex || evidence.context.route !== native.context.route || evidence.context.phase !== native.context.phase) {
      throw new Error('Native Inspector heap response belongs to another benchmark checkpoint')
    }
    return {
      provider,
      toolVersion,
      sdkVersion,
      usage: { status: 'available', source: 'appservice-cdp-runtime', usedSize: evidence.raw.response.usedSize, totalSize: evidence.raw.response.totalSize },
      native: evidence,
    }
  }
  return {
    provider,
    toolVersion,
    sdkVersion,
    usage: await host.getAppServiceHeapUsage!({ timeout: 2_500 }),
  }
}
