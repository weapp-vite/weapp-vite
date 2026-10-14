import { performance } from 'node:perf_hooks'
// eslint-disable-next-line e18e/ban-dependencies -- 统一跨平台构建启动、退出和诊断采样的生命周期。
import { execa } from 'execa'
import { parseCliBuildMs } from './cliTiming'
import { createPeakRssSampler } from './peakRssSampler'
import { sampleProcessTreeRssBytes } from './processTreeRss'

export interface MeasuredBuildOutput {
  status: 'completed' | 'failed'
  stdout: string
  stderr: string
  durationMs?: number
  errorName?: string
}

async function observeBuildOutput(observe: (output: MeasuredBuildOutput) => void | Promise<void>, output: MeasuredBuildOutput) {
  try {
    await observe(output)
  }
  catch {
    // 测量之外的日志保存失败不能替换构建结果和原始异常。
  }
}

/** 构建计时止于进程完成；诊断探针独立收尾，不把探针等待计入构建耗时。 */
export async function runMeasuredBuild(command: string, args: string[], options: { cwd: string, env?: Record<string, string | undefined> }, observe?: (output: MeasuredBuildOutput) => void | Promise<void>) {
  const start = performance.now()
  const child = execa(command, args, { ...options, stdin: 'ignore' })
  const sampler = createPeakRssSampler(async () => typeof child.pid === 'number' ? sampleProcessTreeRssBytes(child.pid) : null)
  try {
    const result = await child
    const durationMs = performance.now() - start
    const memory = await sampler.stop()
    if (observe) {
      await observeBuildOutput(observe, { status: 'completed', stdout: result.stdout, stderr: result.stderr, durationMs })
    }
    return { durationMs, ...memory, cliBuildMs: parseCliBuildMs(`${result.stdout}\n${result.stderr}`) }
  }
  catch (error) {
    if (observe) {
      await sampler.stop()
      const record = error && typeof error === 'object' ? error as { stdout?: unknown, stderr?: unknown } : undefined
      await observeBuildOutput(observe, { status: 'failed', stdout: typeof record?.stdout === 'string' ? record.stdout : '', stderr: typeof record?.stderr === 'string' ? record.stderr : '', errorName: error instanceof Error ? error.name : 'non-error' })
    }
    throw error
  }
  finally {
    await sampler.stop()
  }
}
