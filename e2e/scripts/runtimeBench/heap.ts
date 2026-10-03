import type { AppServiceHeapUsage, AppServiceHeapUsageOptions } from '@weapp-vite/miniprogram-automator'

export interface BenchHeapHost {
  getAppServiceHeapUsage?: (options?: AppServiceHeapUsageOptions) => Promise<AppServiceHeapUsage>
  toolInfo?: () => Promise<unknown>
}

export interface BenchHostHeapSnapshot {
  provider: string
  toolVersion: string | null
  sdkVersion: string | null
  usage: AppServiceHeapUsage | { status: 'unsupported', source: null, reason: 'not-devtools' }
}

/** 只在真实 DevTools 连接上读宿主堆；元数据与堆请求均放在工作负载计时之外。 */
export async function readBenchHostHeap(host: BenchHeapHost, provider: string): Promise<BenchHostHeapSnapshot> {
  if (provider !== 'devtools') {
    return { provider, toolVersion: null, sdkVersion: null, usage: { status: 'unsupported', source: null, reason: 'not-devtools' } }
  }
  if (!host.getAppServiceHeapUsage || !host.toolInfo) {
    throw new Error('DevTools benchmark requires the automator AppService heap API and toolInfo')
  }
  const info = await host.toolInfo()
  const metadata = info !== null && typeof info === 'object' ? info as Record<string, unknown> : {}
  const version = (value: unknown) => typeof value === 'string' && value.trim() ? value : null
  return {
    provider,
    toolVersion: version(metadata.version),
    sdkVersion: version(metadata.SDKVersion),
    usage: await host.getAppServiceHeapUsage({ timeout: 2_500 }),
  }
}
