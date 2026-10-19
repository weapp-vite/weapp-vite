import os from 'node:os'
import { afterEach, expect, it, vi } from 'vitest'
import * as memory from './memory.ts'
import { getResourceBudget } from './resources.ts'

const GIB = 1024 ** 3

afterEach(() => vi.restoreAllMocks())

it('shares the CPU budget across processes and workers and reserves memory for the host', () => {
  const budget = getResourceBudget({ cpus: 16, totalMemoryBytes: 32 * GIB, freeMemoryBytes: 10 * GIB, jobs: 12 })
  expect(budget.jobs).toBe(5)
  expect(budget.jobs * budget.workersPerTask).toBeLessThanOrEqual(budget.cpus)
  expect(budget.buildConcurrency).toBe(2)
  const automatic = getResourceBudget({ cpus: 16, totalMemoryBytes: 64 * GIB, freeMemoryBytes: 64 * GIB })
  expect(automatic.cpuBudget).toBe(8)
  expect(automatic.jobs * automatic.workersPerTask).toBe(8)
  expect(getResourceBudget({ cpus: 16, totalMemoryBytes: 64 * GIB, freeMemoryBytes: 64 * GIB, jobs: 12 }).cpuBudget).toBe(12)
  expect(getResourceBudget({ cpus: 2, totalMemoryBytes: GIB, freeMemoryBytes: GIB, jobs: 20 }).jobs).toBe(1)
  expect(() => getResourceBudget({ jobs: '0' })).toThrow()
  expect(() => getResourceBudget({ jobs: '1.5' })).toThrow()
})

it('budgets cached-memory capacity for both task and build concurrency without losing raw diagnostics', () => {
  vi.spyOn(os, 'freemem').mockReturnValue(GIB)
  const availableMemoryBytes = Math.floor(128 * GIB * 0.54 * 0.5)
  vi.spyOn(memory, 'readMemoryAvailability').mockReturnValue({ availableMemoryBytes, availableMemorySource: 'darwin-memory-pressure' })
  const budget = getResourceBudget({ cpus: 16, totalMemoryBytes: 128 * GIB })
  expect(budget).toMatchObject({ freeMemoryBytes: GIB, availableMemoryBytes, availableMemorySource: 'darwin-memory-pressure', cpuBudget: 8, jobs: 8, buildConcurrency: 8 })
  expect(getResourceBudget({ cpus: 16, totalMemoryBytes: 128 * GIB, jobs: 4 })).toMatchObject({ cpuBudget: 4, jobs: 4, buildConcurrency: 4 })
})

it('keeps explicit free-memory fixtures deterministic and never probes the real host', () => {
  const probe = vi.spyOn(memory, 'readMemoryAvailability')
  expect(getResourceBudget({ cpus: 16, totalMemoryBytes: 128 * GIB, freeMemoryBytes: GIB })).toMatchObject({
    freeMemoryBytes: GIB,
    availableMemoryBytes: GIB,
    availableMemorySource: 'injected',
    jobs: 1,
    buildConcurrency: 1,
  })
  expect(probe).not.toHaveBeenCalled()
})
