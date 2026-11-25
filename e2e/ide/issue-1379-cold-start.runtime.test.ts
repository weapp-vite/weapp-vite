import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectOpenedAutomator, quitWechatIde, resolveProjectAutomatorPort, resolveWechatDevtoolsTarget } from 'weapp-ide-cli'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { inspectDevtoolsHost } from '../utils/devtoolsHostLifecycle'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { launchPtyProcess } from '../utils/ptyProcess'
import { assertPublicIdeCliSelection } from '../utils/publicIdeCliSelection'

const CLI_PATH = process.env.WEAPP_VITE_E2E_WV_CLI_PATH?.trim()
  || path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const AUTOMATOR_PORT = resolveProjectAutomatorPort(TEMPLATE_ROOT)

// eslint-disable-next-line no-control-regex, regexp/no-obscure-range -- 这里需要去掉终端 ANSI 控制序列，便于断言真实 CLI 输出。
const ANSI_ESCAPE_RE = /\u001B\[[0-?]*[ -/]*[@-~]/g

function normalizeTerminalOutput(output: string) {
  return output.replace(ANSI_ESCAPE_RE, '').replace(/\r/g, '\n')
}

async function waitForColdDevtoolsHost(target: Awaited<ReturnType<typeof resolveWechatDevtoolsTarget>>) {
  const deadline = Date.now() + 30_000
  let state = 'unknown'
  while (Date.now() < deadline) {
    state = (await inspectDevtoolsHost(target)).state
    if (state === 'cold') {
      return
    }
    await delay(100)
  }
  throw new Error(`WeChat DevTools did not exit after quit; host state is ${state}.`)
}

describe('Issue 1379 cold DevTools startup', { concurrent: false }, () => {
  let target: Awaited<ReturnType<typeof resolveWechatDevtoolsTarget>>

  beforeAll(async () => {
    await assertPublicIdeCliSelection()
    await cleanupResidualIdeProcesses()
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: TEMPLATE_ROOT,
      platform: 'weapp',
      cwd: TEMPLATE_ROOT,
      label: 'ide:issue-1379-cold-start',
    })
    target = await resolveWechatDevtoolsTarget({ cliPath: process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH })
    await quitWechatIde({ target })
    await waitForColdDevtoolsHost(target)
    const host = await inspectDevtoolsHost(target)
    expect(host.state).toBe('cold')
  }, 480_000)

  afterAll(async () => {
    await cleanupResidualIdeProcesses()
  }, 120_000)

  it('lets ide logs -o cold-start the selected DevTools and attach its bridge', async (context) => {
    const child = launchPtyProcess(process.execPath, [CLI_PATH, 'ide', 'logs', '-o'], {
      cwd: TEMPLATE_ROOT,
      env: {
        ...process.env,
        CONSOLA_LEVEL: '3',
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
    })

    try {
      await child.waitForOutput(output => normalizeTerminalOutput(output).includes('[forwardConsole] 已进入持续监听模式'), 120_000, 'issue 1379 cold-start ide logs bridge')
      const miniProgram = await connectOpenedAutomator({
        projectPath: TEMPLATE_ROOT,
        port: AUTOMATOR_PORT,
        timeout: 15_000,
      })
      try {
        const dom = createDomAcceptance(context, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template', [{
          id: 'cold-start-home',
          route: '/pages/index/index',
          action: '冷启动日志桥接后首页完成渲染',
          nodes: [{ selector: '#count-label', text: '已点击 0 次' }],
        }])
        await dom.check('cold-start-home', miniProgram, await miniProgram.currentPage())
        const toolInfo = await miniProgram.toolInfo()
        expect(toolInfo.version).toBe(target.version)
        expect(typeof toolInfo.SDKVersion).toBe('string')
        process.stdout.write(`[issue-1379] ${JSON.stringify({ devtoolsVersion: toolInfo.version, baseLibraryVersion: toolInfo.SDKVersion, automatorPort: AUTOMATOR_PORT })}\n`)
      }
      finally {
        await miniProgram.disconnect().catch(() => {})
      }
    }
    catch (error) {
      const recentOutput = normalizeTerminalOutput(child.output).split('\n').slice(-100).join('\n')
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n\ncommand: node ${path.basename(CLI_PATH)} ide logs -o\nrecent output:\n${recentOutput}`)
    }
    finally {
      await child.close({ input: '\u0003' })
    }
  }, 180_000)
})
