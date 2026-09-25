import { performance } from 'node:perf_hooks'
// eslint-disable-next-line e18e/ban-dependencies -- 统一跨平台构建启动、退出和诊断采样的生命周期。
import { execa } from 'execa'
import { parseCliBuildMs } from './cliTiming'
import { createPeakRssSampler } from './peakRssSampler'
import { sampleProcessTreeRssBytes } from './processTreeRss'

/** 构建计时止于进程完成；诊断探针独立收尾，不把探针等待计入构建耗时。 */
export async function runMeasuredBuild(command: string, args: string[], options: { cwd: string, env?: Record<string, string | undefined> }) {
  const start = performance.now()
  const child = execa(command, args, { ...options, stdin: 'ignore' })
  const sampler = createPeakRssSampler(async () => typeof child.pid === 'number' ? sampleProcessTreeRssBytes(child.pid) : null)
  try {
    const result = await child
    const durationMs = performance.now() - start
    const memory = await sampler.stop()
    return { durationMs, ...memory, cliBuildMs: parseCliBuildMs(`${result.stdout}\n${result.stderr}`) }
  }
  finally {
    await sampler.stop()
  }
}
