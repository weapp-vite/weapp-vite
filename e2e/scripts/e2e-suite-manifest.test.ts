import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCiFullTasks, getCiPrTasks, getCiTasks, getFullRegressionTasks, getFullTasks, getIdeComponentLibraryTasks, getIdeComponentLibraryVisualFullTasks, getIdeComponentLibraryVisualTasks, getIdeExhaustiveTasks, getSuiteTasks, getWebTasks, IDE_GITHUB_ISSUES_AGGREGATE_LABELS, IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS, partitionE2ETasks } from './e2e-suite-manifest'

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

  it('runs the github issue aggregate once with a bridge wrapper', () => {
    const tasks = getIdeExhaustiveTasks()
    const aggregateTasks = tasks.filter(task => IDE_GITHUB_ISSUES_AGGREGATE_LABELS.includes(task.label))
    const labels = new Set(tasks.map(task => task.label))

    expect(aggregateTasks).toHaveLength(1)
    expect(aggregateTasks.every(task => task.env?.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER === '1')).toBe(true)
    expect(IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS.every(pattern => !labels.has(pattern))).toBe(true)
  })

  it('keeps the PR CI suite as a stable subset of the full CI suite', async () => {
    const fullLabels = new Set((await getCiTasks({ skipDiskBackedDevProbe: true })).map(task => task.label))
    const prTasks = await getCiPrTasks({ skipDiskBackedDevProbe: true })

    expect(prTasks.length).toBeGreaterThan(0)
    expect(prTasks.every(task => fullLabels.has(task.label))).toBe(true)
    expect(prTasks.some(task => task.label.startsWith('hmr-guard:'))).toBe(false)
    expect(prTasks.some(task => task.label === 'ci/issue-862-output-watch.test.ts')).toBe(true)
    expect(await getSuiteTasks('ci-pr')).toEqual(await getCiPrTasks())
    expect(await getSuiteTasks('ci-full')).toEqual(await getCiFullTasks())
  })

  it('partitions the full CI list without overlap and preserves task order per shard', async () => {
    const tasks = await getCiTasks({ skipDiskBackedDevProbe: true })
    const shards = [0, 1, 2, 3].map(index => partitionE2ETasks(tasks, { index, total: 4 }))
    const labels = shards.flat().map(task => task.label)

    expect(labels).toHaveLength(tasks.length)
    expect(new Set(labels).size).toBe(tasks.length)
    expect(new Set(labels)).toEqual(new Set(tasks.map(task => task.label)))
    for (const shard of shards) {
      expect(shard.map(task => tasks.indexOf(task))).toEqual(shard.map(task => tasks.indexOf(task)).sort((a, b) => a - b))
    }
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
