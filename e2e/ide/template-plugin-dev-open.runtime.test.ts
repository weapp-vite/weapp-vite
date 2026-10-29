import type { ManagedWechatProjectRecord } from 'weapp-ide-cli'
import type { PluginProjectLayout } from '../utils/pluginOpenEvidence'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { closeManagedWechatProject, resolveProjectAutomatorPort, resolveWechatDevtoolsTarget } from 'weapp-ide-cli'
import { populateAutomatorProjectSnapshot, readAutomatorProjectPlan } from '../../packages/weapp-ide-cli/src/cli/automatorProject'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { readWechatE2ESelection } from '../utils/devtoolsCli'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../utils/opened-automator'
import { startPackageScriptDevProcess } from '../utils/packageScriptDevProcess'
import { assertPluginOpenEvidence, assertPluginOpenOwnerUnchanged, assertPluginOpenReleased, capturePluginOpenBaseline, readPluginOpenRecords } from '../utils/pluginOpenEvidence'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { assertTemplateDevConfigReleased } from '../utils/templateDevConfigRelease'
import { attachRuntimeErrorCollector, isUninspectableDevtoolsConsoleError } from './runtimeErrors'
import { templateDevOpenCheckpoint } from './templateDevOpenDom'
import { createTemplateDevOpenRunner } from './templateDevOpenSession'
import { assertPluginTemplateLayout, assertPluginTemplateRuntime } from './templatePluginDevOpen/assertions'
import { createPluginTemplateDevOpenArgs, PLUGIN_TEMPLATE_ROOT, PLUGIN_TEMPLATE_ROUTE } from './templatePluginDevOpen/cases'

const runtimeProvider = resolveRuntimeProviderName()
const runCase = createTemplateDevOpenRunner()
const checkpoint = templateDevOpenCheckpoint({ name: 'weapp-vite-plugin-template', root: PLUGIN_TEMPLATE_ROOT, route: PLUGIN_TEMPLATE_ROUTE, expectedText: '插件能力混合演示' })
const KNOWN_PLUGIN_METADATA_DEFECT = '微信开发者工具 2.02.2609082 在插件模板 dev:open 后无法稳定解析插件页面元数据；插件构建产物与 plugin-demo/headless 覆盖仍保持启用。'

async function executePluginCase(
  layout: PluginProjectLayout,
  dom: ReturnType<typeof createDomAcceptance>,
) {
  let dev: ReturnType<typeof startPackageScriptDevProcess> | undefined
  let miniProgram: any
  let opened: ManagedWechatProjectRecord | undefined
  let temporaryRoot: string | undefined
  let headlessClosed = false
  let knownDefect = false
  let errors: ReturnType<typeof attachRuntimeErrorCollector> | undefined

  await runCase({
    name: layout,
    open: async () => {
      if (runtimeProvider === 'headless') {
        // headless 只证明两种实际布局的 runtime；不伪造 CLI 或原生窗口回执。
        await runWeappViteBuildWithLogCapture({
          cliPath: path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js'),
          projectRoot: PLUGIN_TEMPLATE_ROOT,
          platform: 'weapp',
          label: `plugin-template:${layout}:headless`,
        })
        let effective = PLUGIN_TEMPLATE_ROOT
        if (layout === 'snapshot') {
          const plan = await readAutomatorProjectPlan(PLUGIN_TEMPLATE_ROOT)
          if (!plan) {
            throw new Error('Plugin template has no compiled host layout for W.')
          }
          temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-plugin-headless-'))
          effective = path.join(temporaryRoot, 'project')
          await populateAutomatorProjectSnapshot(plan, effective)
        }
        await assertPluginTemplateLayout(PLUGIN_TEMPLATE_ROOT, effective, layout)
        miniProgram = await launchAutomator({ projectPath: effective })
        return miniProgram
      }

      await cleanupResidualIdeProcesses()
      const baseline = capturePluginOpenBaseline(await readPluginOpenRecords())
      const target = await resolveWechatDevtoolsTarget(readWechatE2ESelection())
      const expected = { sourceProjectPath: PLUGIN_TEMPLATE_ROOT, layout, target, port: resolveProjectAutomatorPort(PLUGIN_TEMPLATE_ROOT) }
      dev = startPackageScriptDevProcess('pnpm', createPluginTemplateDevOpenArgs(layout), {
        cwd: PLUGIN_TEMPLATE_ROOT,
        env: createDevProcessEnv({ usePolling: false }),
        reject: false,
      })
      await dev.waitForOutput(/\[forwardConsole\] 已连接微信开发者工具日志/, `plugin ${layout} forward console ready`, 180_000)
      // 此处确认生产消费者就绪后没有第二 owner；首次启动先于消费者的合同由 serve.test.ts 的 connect-only 回归锁定。
      opened = assertPluginOpenEvidence(await readPluginOpenRecords(), baseline, expected)
      const session = await waitForOpenedAutomator(PLUGIN_TEMPLATE_ROOT, {
        // 先读取 runtime 版本以保留已有精确版本缺陷记录，随后两条策略均执行相同的严格首屏检查。
        skipAppReady: true,
        timeoutMs: 120_000,
      })
      miniProgram = session.miniProgram
      const connected = assertPluginOpenEvidence(await readPluginOpenRecords(), baseline, expected, session.metadata.wsEndpoint)
      assertPluginOpenOwnerUnchanged(opened, connected)
      await assertPluginTemplateLayout(PLUGIN_TEMPLATE_ROOT, opened.projectPath, layout)
      const toolInfo = await miniProgram.toolInfo()
      knownDefect = toolInfo.version === '2.02.2609082'
      return miniProgram
    },
    run: async (program) => {
      if (knownDefect) {
        return
      }
      errors = attachRuntimeErrorCollector(program)
      const marker = errors.mark()
      await assertPluginTemplateRuntime(program, dom)
      expect(errors.getSince(marker).filter(message => !isUninspectableDevtoolsConsoleError(message))).toEqual([])
      expect(errors.getAll().filter(message => /DevRuntime|module .* is not defined|SystemError|MiniProgramError/i.test(message))).toEqual([])
    },
    cleanup: async () => {
      await runCleanupSteps([
        { label: 'detach plugin runtime logs', run: () => errors?.dispose() },
        { label: 'stop plugin dev and log consumer', run: async () => {
          if (dev) {
            await dev.stop()
            await assertTemplateDevConfigReleased(PLUGIN_TEMPLATE_ROOT)
          }
        } },
        { label: 'disconnect plugin borrowed socket', run: async () => { await miniProgram?.disconnect() } },
        { label: 'close exact plugin owner', run: async () => {
          if (opened) {
            await closeManagedWechatProject({ journalPath: opened.journalPath, id: opened.id })
          }
          else if (runtimeProvider === 'headless') {
            await miniProgram?.close()
            headlessClosed = true
          }
        } },
        { label: 'release remaining task-owned plugin resources', run: cleanupResidualIdeProcesses },
        { label: 'verify plugin window and snapshot release', run: async () => {
          if (opened) {
            assertPluginOpenReleased(await readPluginOpenRecords(), opened)
            if (layout === 'snapshot') {
              await expect(fs.access(opened.projectPath)).rejects.toMatchObject({ code: 'ENOENT' })
            }
          }
        } },
        { label: 'remove headless plugin fixture', run: async () => {
          if (temporaryRoot) {
            if (miniProgram && !headlessClosed) {
              throw new Error('Headless plugin session did not close; preserving its fixture.')
            }
            await fs.rm(temporaryRoot, { recursive: true, force: true })
          }
        } },
      ])
    },
  })
  return knownDefect
}

describe('plugin template dev:open IDE integration', { concurrent: false }, () => {
  // 两条用户命令必须取得各自 fresh owner，不能在同一窗口内切换策略。
  describe('default CLI P', () => {
    it('default CLI opens source plugin project', async (ctx) => {
      const dom = createDomAcceptance(ctx, 'templates/weapp-vite-plugin-template', [checkpoint])
      const knownDefect = await executePluginCase('source', dom)
      // skip 在资源收尾后报告，不让 Vitest 的 skip 信号被失败冻结器误当成下一条路径的启动故障。
      if (knownDefect) {
        ctx.skip(KNOWN_PLUGIN_METADATA_DEFECT)
      }
    }, 480_000)
  })

  describe('explicit automator W', () => {
    it('explicit automator opens owned plugin snapshot', async (ctx) => {
      const dom = createDomAcceptance(ctx, 'templates/weapp-vite-plugin-template', [checkpoint])
      const knownDefect = await executePluginCase('snapshot', dom)
      if (knownDefect) {
        ctx.skip(KNOWN_PLUGIN_METADATA_DEFECT)
      }
    }, 480_000)
  })
})
