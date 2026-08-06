import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getFullRegressionTasks, getFullTasks, getIdeComponentLibraryTasks, getIdeComponentLibraryVisualFullTasks, getIdeComponentLibraryVisualTasks, getSuiteTasks, getWebTasks } from './e2e-suite-manifest'

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

  it('registers component library IDE coverage as a standalone entry', async () => {
    expect(await getSuiteTasks('ide-component-libraries')).toEqual(getIdeComponentLibraryTasks())
  })

  it('registers runtime and visual component library entries separately', async () => {
    expect(await getSuiteTasks('ide-component-libraries:visual')).toEqual(getIdeComponentLibraryVisualTasks())
    expect(await getSuiteTasks('ide-component-libraries:visual-full')).toEqual(getIdeComponentLibraryVisualFullTasks())
    expect(getIdeComponentLibraryTasks()[0]?.env?.WEAPP_VITE_COMPONENT_LIBRARY_MODE).toBe('runtime')
    expect(getIdeComponentLibraryVisualTasks()[0]?.env?.WEAPP_VITE_COMPONENT_LIBRARY_MODE).toBe('visual')
    expect(getIdeComponentLibraryVisualFullTasks()[0]?.env?.WEAPP_VITE_COMPONENT_LIBRARY_MODE).toBe('visual-full')
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
