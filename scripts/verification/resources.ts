import type { ResourceBudget } from './types.ts'
import os from 'node:os'
import process from 'node:process'

const GIB = 1024 ** 3

/** 在进程与 worker 两层之间共享 CPU、内存预算，避免并发相乘。 */
export function getResourceBudget(options: {
  cpus?: number
  totalMemoryBytes?: number
  freeMemoryBytes?: number
  jobs?: string | number
} = {}): ResourceBudget {
  const cpus = Math.max(1, options.cpus ?? os.availableParallelism())
  const totalMemoryBytes = options.totalMemoryBytes ?? os.totalmem()
  const freeMemoryBytes = options.freeMemoryBytes ?? os.freemem()
  const requested = options.jobs ?? process.env.WEAPP_VITE_VERIFY_JOBS
  if (requested !== undefined && (!/^\d+$/.test(String(requested)) || Number(requested) < 1)) {
    throw new Error('验证并发数必须是正整数')
  }
  const memoryJobs = Math.max(1, Math.floor((Math.min(totalMemoryBytes, freeMemoryBytes) - 2 * GIB) / (1.5 * GIB)))
  // 默认给桌面和其他工作保留一半核；显式 jobs 可提高，但不能突破实际 CPU/内存。
  const cpuBudget = Math.max(1, Math.min(Number(requested ?? Math.floor(cpus / 2)), cpus))
  const jobs = Math.max(1, Math.min(cpuBudget, memoryJobs))
  return {
    cpus,
    cpuBudget,
    totalMemoryBytes,
    freeMemoryBytes,
    jobs,
    workersPerTask: 1,
    buildConcurrency: Math.max(1, Math.min(jobs, Math.floor((freeMemoryBytes - 2 * GIB) / (3 * GIB)))),
  }
}
