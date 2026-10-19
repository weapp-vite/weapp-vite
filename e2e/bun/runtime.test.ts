import { rm } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createBunProject, expectBunOutputs, readBunJavaScript, requestBunShutdown, runBunScript, updateBunPage } from '../utils/bunProject'
import { createDomAcceptance } from '../utils/domAcceptance'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'

it('renders Bun dev output and updated page defaults in the same runtime session', async (ctx) => {
  const project = await createBunProject()
  let dev: ReturnType<typeof runBunScript> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  let runtimeAttempted = false
  let runtimeClosed = false
  let output = ''
  try {
    dev = runBunScript(project, 'dev', 'stateful-experimental')
    dev.all?.on('data', chunk => output += String(chunk))
    await Promise.race([
      expect.poll(() => output.includes('开发服务已就绪'), { timeout: 90_000 }).toBe(true),
      dev.then((result) => { throw new Error(`Bun dev exited before ready: ${result.exitCode}\n${output}`) }),
    ])
    await expectBunOutputs(project, 'bun-initial')
    runtimeAttempted = true
    miniProgram = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: '/pages/index/index',
      warmupRootSelectors: ['#issue-1222-marker'],
      configureHeadlessSession: (session) => {
        disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist'))
      },
    })
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues/fixtures/issue-1222', [
      { id: 'initial', route: '/pages/index/index', action: '读取 Bun 首次构建页面', nodes: [{ selector: '#issue-1222-marker', text: 'bun-initial' }] },
      { id: 'updated', route: '/pages/index/index', action: '修改源码后在同一会话重新进入页面', nodes: [{ selector: '#issue-1222-marker', text: 'bun-updated' }] },
    ])
    const initial = await miniProgram.reLaunch('/pages/index/index')
    await dom.check('initial', miniProgram, initial)
    await updateBunPage(project)
    await expect.poll(() => readBunJavaScript(project).catch(() => ''), { timeout: 30_000 }).toContain('bun-updated')
    // 先证明真实更新已到达 AppService，再导航；文件写出不能替代 runtime 更新完成。
    await expect.poll(() => initial.callMethod('readMarker'), { timeout: 30_000 }).toBe('bun-updated')
    const updated = await miniProgram.reLaunch('/pages/index/index')
    await dom.check('updated', miniProgram, updated)
    await expectBunOutputs(project, 'bun-updated')
  }
  finally {
    try {
      disposeTransport?.()
      if (miniProgram) {
        await miniProgram.close()
        runtimeClosed = true
      }
    }
    finally {
      if (dev && dev.nodeChildProcess.exitCode === null && dev.nodeChildProcess.signalCode === null) {
        await requestBunShutdown(project, output)
        const timer = setTimeout(() => dev?.kill('SIGTERM'), 10_000)
        try {
          const result = await dev
          expect(result.exitCode, output).toBe(143)
        }
        finally {
          clearTimeout(timer)
        }
      }
      // 未取得 session 的启动失败仍可能持有窗口意图，保留目录供领域层精确收尾。
      if (!runtimeAttempted || runtimeClosed) {
        await rm(project, { recursive: true, force: true })
      }
    }
  }
}, 240_000)
