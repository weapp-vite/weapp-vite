import { expect, it } from 'vitest'
import { getResourceBudget } from './resources.ts'

const GIB = 1024 ** 3

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
