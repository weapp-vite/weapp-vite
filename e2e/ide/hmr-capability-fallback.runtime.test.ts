import { createHmrCapabilityFallbackSuite } from './statefulHmrDom/capabilityFallback'

// 兼容旧入口；正式清单按宿主分别执行，避免重复覆盖。
for (const host of ['wv', 'vite', 'vite-plus'] as const) {
  createHmrCapabilityFallbackSuite(host)
}
