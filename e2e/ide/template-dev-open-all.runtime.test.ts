import type { TemplateDevOpenCase as TemplateCase } from './template-dev-open-cases'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  resolveProjectAutomatorPort,
} from 'weapp-ide-cli'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../utils/opened-automator'
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
  dev: ReturnType<typeof startDevProcess>
}

function resolveTemplateProjectRoot(templateCase: TemplateCase) {
  return resolveTemplateDevOpenProjectRoot(templateCase)
}

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
}

function resolveAutomatorWrapperProjectPath(projectPath: string) {
  const sourceProjectPath = path.resolve(projectPath)
  const distRoot = path.resolve(sourceProjectPath, 'dist')
  const wrapperHash = createHash('sha1')
    .update(sourceProjectPath)
    .update('\0')
    .update(distRoot)
    .digest('hex')
    .slice(0, 16)
  return path.join(os.tmpdir(), 'weapp-ide-cli-automator-projects', wrapperHash)
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function removeAutomatorSessionFiles(projectPath: string) {
  await Promise.all([
    fs.rm(resolveAutomatorSessionFile(projectPath), { force: true }).catch(() => {}),
    fs.rm(resolveAutomatorSessionFile(projectPath, resolveProjectAutomatorPort(projectPath)), { force: true }).catch(() => {}),
  ])
}

async function assertPluginTemplateWrapperProject(sourceProjectPath: string, wrapperProjectPath: string) {
  await expect(JSON.parse(await fs.readFile(path.join(wrapperProjectPath, 'project.config.json'), 'utf8'))).toMatchObject({
    compileType: 'plugin',
    miniprogramRoot: './',
    pluginRoot: 'dist-plugin/',
    srcMiniprogramRoot: './',
    setting: {
      packNpmManually: false,
      packNpmRelationList: [],
    },
  })
  const sourceAppConfig = JSON.parse(await fs.readFile(path.join(sourceProjectPath, 'src/app.json'), 'utf8'))
  await expect(JSON.parse(await fs.readFile(path.join(wrapperProjectPath, 'app.json'), 'utf8'))).toMatchObject({
    pages: sourceAppConfig.pages,
    plugins: sourceAppConfig.plugins,
    subPackages: [],
  })
  await expect(fs.access(path.join(wrapperProjectPath, 'pages/index/index.wxml'))).resolves.toBeUndefined()
  await expect(fs.access(path.join(wrapperProjectPath, 'dist-plugin/plugin.json'))).resolves.toBeUndefined()
  await expect(fs.access(path.join(wrapperProjectPath, 'dist-plugin/index.js'))).resolves.toBeUndefined()
}

async function waitForTemplateCaseReady(miniProgram: any, templateCase: TemplateCase, wrapperProjectPath: string) {
  if (templateCase.assertWrapperProject) {
    await assertPluginTemplateWrapperProject(templateCase.root, wrapperProjectPath)
    return await miniProgram.currentPage()
  }

  return await waitForTemplatePageReady(
    miniProgram,
    templateCase.route,
    templateCase.expectedText,
    templateCase.expectedData,
  )
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

  if (!process.assertWrapperProject) {
    await process.dev.waitForOutput(
      FORWARD_CONSOLE_READY_RE,
      `${process.name} forward console ready`,
      FORWARD_CONSOLE_READY_TIMEOUT_MS,
    )
  }
  const readySession = waitForOpenedAutomator(resolveTemplateProjectRoot(process), {
    readyRoute: process.assertWrapperProject ? undefined : process.route,
    skipAppReady: process.assertWrapperProject,
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

async function cleanupTemplateAutomatorState(templateCase: TemplateCase) {
  const projectRoot = resolveTemplateProjectRoot(templateCase)
  await Promise.all([
    removeAutomatorSessionFiles(projectRoot),
    fs.rm(resolveAutomatorWrapperProjectPath(projectRoot), { force: true, recursive: true }).catch(() => {}),
  ])
}

function startTemplateDevProcess(templateCase: TemplateCase): TemplateDevProcess {
  return {
    ...templateCase,
    dev: startDevProcess('pnpm', createTemplateDevOpenArgs(templateCase), {
      cwd: templateCase.root,
      env: createDevProcessEnv({ usePolling: false }),
      reject: false,
    }),
  }
}

function isTemplateRuntimeInfraError(error: unknown) {
  return error instanceof Error && IDE_AUTOMATOR_INFRA_RE.test(error.message)
}

function isTemplateProtocolTimeout(error: unknown) {
  return error instanceof Error && /Latest DevTools protocol timeout|DevTools did not respond to protocol method/i.test(error.message)
}

async function openTemplateDevProcess(templateCase: TemplateCase) {
  if (USE_PRESTARTED_TEMPLATE_DEV) {
    const projectRoot = resolveTemplateProjectRoot(templateCase)
    return {
      devProcess: undefined,
      session: await waitForOpenedAutomator(projectRoot, {
        readyRoute: templateCase.assertWrapperProject ? undefined : templateCase.route,
        skipAppReady: templateCase.assertWrapperProject,
        timeoutMs: 120_000,
      }),
    }
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await cleanupResidualIdeProcesses()
    await cleanupTemplateAutomatorState(templateCase)
    const devProcess = startTemplateDevProcess(templateCase)
    try {
      const session = await waitForTemplateDevOpenReady(devProcess)
      return { devProcess, session }
    }
    catch (error) {
      lastError = error
      await devProcess.dev.stop().catch(() => {})
      const projectRoot = resolveTemplateProjectRoot(templateCase)
      await closeSharedMiniProgram(projectRoot, resolveProjectAutomatorPort(projectRoot)).catch(() => {})
      await cleanupResidualIdeProcesses()
      if (attempt < 2) {
        process.stdout.write(`[warn] [template-dev-open-all] retry dev:open template=${templateCase.name} reason=${error instanceof Error ? error.message : String(error)}\n`)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

describe('all templates dev:open IDE integration', { concurrent: false }, () => {
  beforeAll(async () => {
    if (USE_PRESTARTED_TEMPLATE_DEV) {
      return
    }
    await cleanupResidualIdeProcesses()
    await Promise.all(ACTIVE_TEMPLATE_CASES.map(async templateCase => await cleanupTemplateAutomatorState(templateCase)))
  }, 60_000)

  afterAll(async () => {
    if (USE_PRESTARTED_TEMPLATE_DEV) {
      return
    }
    await cleanupTrackedDevProcesses()
    await Promise.all(ACTIVE_TEMPLATE_CASES.map(async templateCase => await closeSharedMiniProgram(
      resolveTemplateProjectRoot(templateCase),
      resolveProjectAutomatorPort(resolveTemplateProjectRoot(templateCase)),
    ).catch(() => {})))
    await cleanupResidualIdeProcesses()
  }, 180_000)

  it.for(ACTIVE_TEMPLATE_CASES)('$name renders after dev:open without runtime errors', async (templateCase, ctx) => {
    let lastError: unknown
    let dom: ReturnType<typeof createDomAcceptance> | undefined
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const projectRoot = resolveTemplateProjectRoot(templateCase)
      const port = resolveProjectAutomatorPort(projectRoot)
      const { devProcess, session } = await openTemplateDevProcess(templateCase)
      let miniProgram: any
      let runtimeErrors: ReturnType<typeof attachRuntimeErrorCollector> | undefined
      try {
        miniProgram = session.miniProgram
        if (templateCase.name === 'weapp-vite-plugin-template') {
          const toolInfo = await miniProgram.toolInfo?.().catch(() => undefined)
          if (toolInfo?.version === '2.02.2609082') {
            ctx.skip('微信开发者工具 2.02.2609082 在插件模板 dev:open 后无法稳定解析插件页面元数据；插件构建产物与 plugin-demo/headless 覆盖仍保持启用。')
            return
          }
        }
        // DOM 计划属于 case；基础设施重试仅替换连接，保留同一个验收计划。
        dom ??= createDomAcceptance(ctx, `templates/${templateCase.name}`, [templateDevOpenCheckpoint(templateCase)])
        runtimeErrors = attachRuntimeErrorCollector(miniProgram)
        const runtimeMarker = runtimeErrors.mark()
        const { metadata } = session
        expect(path.resolve(metadata.projectPath)).toBe(projectRoot)
        expect(metadata.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
        const wrapperProjectPath = resolveAutomatorWrapperProjectPath(projectRoot)
        const wrapperProjectConfig = path.join(wrapperProjectPath, 'project.config.json')
        const usesWrapperProject = await fs.access(wrapperProjectConfig).then(() => true).catch(() => false)
        const projectConfigPath = usesWrapperProject
          ? wrapperProjectConfig
          : path.join(projectRoot, 'project.config.json')
        const projectConfig = JSON.parse(await fs.readFile(projectConfigPath, 'utf8'))
        expect(projectConfig).toMatchObject(usesWrapperProject
          ? {
              miniprogramRoot: './',
              srcMiniprogramRoot: './',
            }
          : templateCase.projectRoot
            ? {
                miniprogramRoot: 'dist',
                srcMiniprogramRoot: 'dist',
              }
            : {
                miniprogramRoot: 'dist/',
                srcMiniprogramRoot: 'dist/',
              })

        try {
          const page = await waitForTemplateCaseReady(miniProgram, templateCase, wrapperProjectPath)
          await dom.check('opened', miniProgram, page)
        }
        catch (error) {
          throw new Error(`[${templateCase.name}] ${error instanceof Error ? error.message : String(error)}`)
        }
        expect(runtimeErrors.getSince(runtimeMarker).filter(message => !isUninspectableDevtoolsConsoleError(message))).toEqual([])
        expect(runtimeErrors.getAll().filter(message => /DevRuntime|module .* is not defined|SystemError|MiniProgramError/i.test(message))).toEqual([])
        return
      }
      catch (error) {
        lastError = error
        const canRetry = isTemplateRuntimeInfraError(error) || isTemplateProtocolTimeout(error)
        if (attempt >= 2 || !canRetry) {
          throw new Error(`[${templateCase.name}] ${error instanceof Error ? error.message : String(error)}`)
        }
        process.stdout.write(`[warn] [template-dev-open-all] retry runtime template=${templateCase.name} reason=${error instanceof Error ? error.message : String(error)}\n`)
      }
      finally {
        runtimeErrors?.dispose()
        try {
          miniProgram?.disconnect?.()
        }
        catch {}
        await devProcess?.dev.stop().catch(() => {})
        await closeSharedMiniProgram(
          projectRoot,
          port,
        ).catch(() => {})
        if (!USE_PRESTARTED_TEMPLATE_DEV) {
          await cleanupResidualIdeProcesses()
        }
        await delay(2_000)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }, 480_000)
})
