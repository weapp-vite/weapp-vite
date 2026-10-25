import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { fs } from '@weapp-core/shared/fs'
import CI from 'ci-info'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import { createBundleRuntime, readBundleOutputs } from './bundleRuntime'
import { getFixture, normalizeBuildOutputContent, scanFiles } from './utils'

interface ChartPayload {
  spec: { axes: Array<{ label: { formatMethod: (text: string) => string } }> }
}

interface ChartPage {
  data: unknown
  chartType: string
  stage: unknown
  onLoad: (this: { chartType: string, setData: (payload: ChartPayload) => void }, options: { name?: string }) => void
  onChartInit: (event: unknown) => void
  onChartReady: (event: unknown) => void
}

function observeChartPage(definition: ChartPage, log: ReturnType<typeof vi.fn>) {
  const loads = [{ name: 'demo' }, {}].map((options) => {
    const setData = vi.fn<(payload: ChartPayload) => void>()
    const instance = { chartType: definition.chartType, setData }
    definition.onLoad.call(instance, options)
    expect(setData).toHaveBeenCalledTimes(1)
    const payload = setData.mock.calls[0]![0]
    return {
      chartType: instance.chartType,
      payload: JSON.parse(JSON.stringify(payload)),
      formattedLabel: payload.spec.axes[0]!.label.formatMethod('123'),
    }
  })
  const event = { detail: { chart: 'fixture-chart' } }
  definition.onChartInit(event)
  definition.onChartReady(event)
  expect(log.mock.calls.map(call => call[1])).toEqual([event, event])
  return {
    keys: Object.keys(definition).sort(),
    data: definition.data,
    chartType: definition.chartType,
    stage: definition.stage,
    loads,
    events: log.mock.calls,
  }
}

vi.mock('@/logger', () => ({
  // ...await importOriginal<typeof import('@/logger')>(),
  default: {
    warn: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  configureLogger: vi.fn(),
  // warn: vi.fn(),
}))

describe.skipIf(CI.isCI)('build import-umd', () => {
  const cwd = getFixture('import-umd')
  const distDir = path.resolve(cwd, 'dist')
  beforeEach(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.build()
    expect(logger.warn).toHaveBeenCalledWith('没有找到 `pages/index/vue` 的入口文件，请检查路径是否正确!')
    expect(await fs.exists(distDir)).toBe(true)
  })

  it('dist', async () => {
    expect(await fs.exists(path.resolve(distDir))).toBe(true)
    const files = await scanFiles(distDir)
    const outputs = await readBundleOutputs(distDir, files)
    const nonJsOutputs = outputs.filter(({ file }) => !file.endsWith('.js'))
    expect(nonJsOutputs.map(({ file }) => file)).toMatchSnapshot()
    for (const { file, content } of nonJsOutputs) {
      expect(normalizeBuildOutputContent(content)).toMatchSnapshot(file)
    }
    expect(files).toContain('components/chart/index.js')
    const runtime = createBundleRuntime(outputs.filter(({ file }) => file !== 'components/chart/index.js'))
    runtime.assertDependencyGraph()
    runtime.assertAppAndNavbar()
    runtime.load('pages/index/index.js')
    expect(runtime.page).toHaveBeenCalledTimes(1)
    const emitted = runtime.page.mock.calls[0]![0] as unknown as ChartPage

    // 独立执行原始页面作为行为基准，覆盖完整图表数据、回调和默认参数。
    const source = await fs.readFile(path.join(cwd, 'src/pages/index/index.ts'), 'utf8')
    const sourcePage = vi.fn<(definition: ChartPage) => void>()
    const sourceLog = vi.fn()
    runInNewContext(stripTypeScriptTypes(source), { Page: sourcePage, console: { log: sourceLog } })
    expect(sourcePage).toHaveBeenCalledTimes(1)
    expect(observeChartPage(emitted, runtime.log)).toEqual(observeChartPage(sourcePage.mock.calls[0]![0], sourceLog))
    runtime.assertAllScriptsReachable()
  })
})
