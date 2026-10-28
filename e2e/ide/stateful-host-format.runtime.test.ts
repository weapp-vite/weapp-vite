import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createStatefulHostFormatProject } from '../utils/statefulHostFormatProject'

let miniProgram: any
let project: Awaited<ReturnType<typeof createStatefulHostFormatProject>> | undefined
const route = '/pages/index/index'

describe('stateful host format dynamic imports (issue #1275)', { concurrent: false }, () => {
  beforeAll(async () => {
    project = await createStatefulHostFormatProject()
    miniProgram = await launchAutomator({
      projectPath: project.projectRoot,
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['.result'],
    })
  })

  afterAll(async () => {
    // 宿主未确认关闭时保留项目，避免移除仍被使用的文件。
    if (miniProgram) {
      await miniProgram.close()
      await project?.cleanup()
    }
    else if (project) {
      process.stderr.write(`保留启动失败的宿主格式项目供领域恢复: ${project.projectRoot}\n`)
    }
  })

  it('loads split modules lazily with shared state and rejects evaluation errors asynchronously', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/stateful-host-format', [
      { id: 'initial', route, action: '确认首屏尚未加载动态分块', nodes: [{ selector: '.result', text: 'not loaded' }] },
      { id: 'lazy-loaded', route, action: '确认首次异步加载的返回值和执行次数', nodes: [{ selector: '.result', text: '21:1' }] },
      { id: 'shared-state', route, action: '确认缓存分块读取更新后的共享状态', nodes: [{ selector: '.result', text: '24:1' }] },
      { id: 'rejected', route, action: '确认分块求值失败被异步捕获并渲染', nodes: [{ selector: '.error', text: 'stateful dynamic import evaluation failed' }] },
    ])
    const page = await miniProgram.currentPage()
    await dom.check('initial', miniProgram, page)
    expect(await page.callMethod('loadDynamicImport')).toEqual({ before: 0, immediate: 0, value: 21, evaluations: 1 })
    await dom.check('lazy-loaded', miniProgram, page)
    await page.callMethod('setSharedValue', 8)
    expect(await page.callMethod('loadDynamicImport')).toEqual({ before: 1, immediate: 1, value: 24, evaluations: 1 })
    await dom.check('shared-state', miniProgram, page)
    expect(await page.callMethod('loadBrokenDynamicImport')).toEqual({ synchronous: false, message: 'stateful dynamic import evaluation failed' })
    await dom.check('rejected', miniProgram, page)
  })
})
