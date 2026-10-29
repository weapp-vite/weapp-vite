import type { TemplateDevOpenCase as TemplateCase } from './template-dev-open-cases'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  resolveProjectAutomatorPort,
} from 'weapp-ide-cli'
import { runCleanupSteps } from '../utils/cleanupSteps'
import {
  cleanupTrackedDevProcesses,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../utils/opened-automator'
import { startPackageScriptDevProcess } from '../utils/packageScriptDevProcess'
import { assertTemplateDevConfigReleased } from '../utils/templateDevConfigRelease'
import { waitForTemplatePageReady } from '../utils/templatePageReady'
import {
  attachRuntimeErrorCollector,
  isUninspectableDevtoolsConsoleError,
} from './runtimeErrors'
import {
  createTemplateDevOpenArgs,
  resolveTemplateDevOpenProjectRoot,
  TEMPLATE_DEV_OPEN_CASES,
} from './template-dev-open-cases'
import { templateDevOpenCheckpoint } from './templateDevOpenDom'
import { createTemplateDevOpenRunner } from './templateDevOpenSession'

const IDE_AUTOMATOR_INFRA_RE = /Failed connecting to ws:\/\/127\.0\.0\.1:\d+|Timed out waiting for opened automator ws:\/\/127\.0\.0\.1:\d+|无法连接到当前项目的微信开发者工具自动化 websocket|Cannot connect to the Wechat DevTools automation websocket|automation websocket|Connection closed, check if wechat web devTools is still running|WebSocket is not open|socket hang up|Wait timed out after \d+ ms|当前项目已完成打开流程，但尚未连接到可复用的自动化会话/i
const FORWARD_CONSOLE_READY_RE = /\[forwardConsole\] 已连接微信开发者工具日志/
const FORWARD_CONSOLE_READY_TIMEOUT_MS = 180_000

const TEMPLATE_FILTER = process.env.WEAPP_VITE_E2E_TEMPLATE?.trim()
const TEMPLATE_EXCLUDE = process.env.WEAPP_VITE_E2E_EXCLUDE_TEMPLATE?.trim()
const USE_PRESTARTED_TEMPLATE_DEV = process.env.WEAPP_VITE_E2E_PRESTARTED_TEMPLATE_DEV === '1'
const ACTIVE_TEMPLATE_CASES = TEMPLATE_DEV_OPEN_CASES.filter((templateCase) => {
  if (TEMPLATE_FILTER && templateCase.name !== TEMPLATE_FILTER) {
    return false
  }
  return !TEMPLATE_EXCLUDE || templateCase.name !== TEMPLATE_EXCLUDE
})

type TemplateDevProcess = TemplateCase & {
  dev: ReturnType<typeof startPackageScriptDevProcess>
}

function resolveTemplateProjectRoot(templateCase: TemplateCase) {
  return resolveTemplateDevOpenProjectRoot(templateCase)
}

async function waitForTemplateDevOpenReady(process: TemplateDevProcess) {
  let infraOutput = ''
  void process.dev.waitForOutput(
    IDE_AUTOMATOR_INFRA_RE,
    `${process.name} dev:open automator early infra notice`,
    75_000,
  ).then((output) => {
    infraOutput = output.length > 4_000 ? output.slice(-4_000) : output
  }).catch(() => {})

  await process.dev.waitForOutput(
    FORWARD_CONSOLE_READY_RE,
    `${process.name} forward console ready`,
    FORWARD_CONSOLE_READY_TIMEOUT_MS,
  )
  const readySession = waitForOpenedAutomator(resolveTemplateProjectRoot(process), {
    readyRoute: process.route,
    timeoutMs: 120_000,
  }).catch((error) => {
    const details = infraOutput ? `\nRecent infra output:\n${infraOutput}` : ''
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`WeChat DevTools automator unavailable while opening ${process.name}: ${reason}${details}`, {
      cause: error as Error,
    })
  })
  await process.dev.waitFor(
    readySession,
    `${process.name} dev:open ready`,
  )
  return await readySession
}

function startTemplateDevProcess(templateCase: TemplateCase): TemplateDevProcess {
  return {
    ...templateCase,
    dev: startPackageScriptDevProcess('pnpm', createTemplateDevOpenArgs(templateCase), {
      cwd: templateCase.root,
      env: createDevProcessEnv({ usePolling: false }),
      reject: false,
    }),
  }
}

describe('all templates dev:open IDE integration', { concurrent: false }, () => {
  const runTemplateCase = createTemplateDevOpenRunner()

  beforeAll(async () => {
    if (USE_PRESTARTED_TEMPLATE_DEV) {
      return
    }
    await cleanupResidualIdeProcesses()
  }, 60_000)

  afterAll(async () => {
    if (USE_PRESTARTED_TEMPLATE_DEV) {
      return
    }
    await runCleanupSteps([
      { label: 'stop tracked template dev processes', run: cleanupTrackedDevProcesses },
      ...ACTIVE_TEMPLATE_CASES.map(templateCase => ({
        label: `close owned template window ${templateCase.name}`,
        run: async () => {
          await closeSharedMiniProgram(
            resolveTemplateProjectRoot(templateCase),
            resolveProjectAutomatorPort(resolveTemplateProjectRoot(templateCase)),
          )
        },
      })),
      { label: 'release template IDE resources', run: cleanupResidualIdeProcesses },
    ])
  }, 180_000)

  it.for(ACTIVE_TEMPLATE_CASES)('$name renders after dev:open without runtime errors', { timeout: 480_000 }, async (templateCase, ctx) => {
    const projectRoot = resolveTemplateProjectRoot(templateCase)
    const port = resolveProjectAutomatorPort(projectRoot)
    let devProcess: TemplateDevProcess | undefined
    let miniProgram: Awaited<ReturnType<typeof waitForOpenedAutomator>>['miniProgram'] | undefined
    let runtimeErrors: ReturnType<typeof attachRuntimeErrorCollector> | undefined

    await runTemplateCase({
      name: templateCase.name,
      open: async () => {
        if (USE_PRESTARTED_TEMPLATE_DEV) {
          return await waitForOpenedAutomator(projectRoot, {
            readyRoute: templateCase.route,
            timeoutMs: 120_000,
          })
        }
        await cleanupResidualIdeProcesses()
        devProcess = startTemplateDevProcess(templateCase)
        return await waitForTemplateDevOpenReady(devProcess)
      },
      run: async (session) => {
        miniProgram = session.miniProgram
        const dom = createDomAcceptance(ctx, `templates/${templateCase.name}`, [templateDevOpenCheckpoint(templateCase)])
        runtimeErrors = attachRuntimeErrorCollector(miniProgram)
        const runtimeMarker = runtimeErrors.mark()
        const { metadata } = session
        expect(path.resolve(metadata.projectPath)).toBe(projectRoot)
        expect(metadata.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
        const projectConfig = JSON.parse(await fs.readFile(path.join(projectRoot, 'project.config.json'), 'utf8')) as Record<string, unknown>
        expect(projectConfig).toMatchObject(templateCase.projectRoot
          ? { miniprogramRoot: 'dist', srcMiniprogramRoot: 'dist' }
          : { miniprogramRoot: 'dist/', srcMiniprogramRoot: 'dist/' })

        try {
          const page = await waitForTemplatePageReady(miniProgram, templateCase.route, templateCase.expectedText, templateCase.expectedData)
          await dom.check('opened', miniProgram, page)
        }
        catch (error) {
          throw new Error(`[${templateCase.name}] ${error instanceof Error ? error.message : String(error)}`, { cause: error })
        }
        expect(runtimeErrors.getSince(runtimeMarker).filter(message => !isUninspectableDevtoolsConsoleError(message))).toEqual([])
        expect(runtimeErrors.getAll().filter(message => /DevRuntime|module .* is not defined|SystemError|MiniProgramError/i.test(message))).toEqual([])
      },
      cleanup: async () => {
        await runCleanupSteps([
          { label: 'detach template runtime logs', run: () => runtimeErrors?.dispose() },
          { label: 'disconnect template automator', run: async () => { await miniProgram?.disconnect?.() } },
          { label: 'stop template dev process', run: async () => {
            if (devProcess) {
              await devProcess.dev.stop()
              await assertTemplateDevConfigReleased(projectRoot)
            }
          } },
          { label: 'close owned template window', run: async () => { await closeSharedMiniProgram(projectRoot, port) } },
          ...(!USE_PRESTARTED_TEMPLATE_DEV ? [{ label: 'release template IDE resources', run: cleanupResidualIdeProcesses }] : []),
        ])
      },
    })
  })
})
