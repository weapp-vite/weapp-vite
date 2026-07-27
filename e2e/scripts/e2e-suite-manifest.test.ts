import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getFullRegressionTasks, getFullTasks, getSuiteTasks, getWebTasks } from './e2e-suite-manifest'

describe('e2e suite manifest', () => {
  it('runs the web suite through its dedicated Vitest config', () => {
    expect(getWebTasks()).toEqual([{
      label: 'web-runtime',
      command: 'pnpm',
      args: [
        'vitest',
        'run',
        '-c',
        path.resolve(import.meta.dirname, '../vitest.e2e.web.config.ts'),
      ],
    }])
  })

  it('registers the web suite as a standalone entry', async () => {
    expect(await getSuiteTasks('web')).toEqual(getWebTasks())
  })

  it('keeps web coverage between ci and ide in aggregate entries', () => {
    expect(getFullTasks().map(task => task.label)).toEqual([
      'e2e:ci',
      'e2e:web',
      'e2e:ide',
    ])
    expect(getFullRegressionTasks().map(task => task.label)).toEqual([
      'e2e:ci',
      'e2e:web',
      'e2e:ide:full',
    ])
  })
})
