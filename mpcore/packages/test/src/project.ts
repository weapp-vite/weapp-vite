import type { HeadlessProjectDescriptor, RuntimeDiagnosticEntry } from '@mpcore/simulator'
import type {
  CreateTestProjectOptions,
  MiniProgramRenderResult,
  RenderComponentOptions,
} from './types'
import {
  createArtifactProject,
  createHeadlessSession,
  HeadlessTestingPageHandle,
  loadProject,
  wechat,
} from '@mpcore/simulator'
import { createComponentRenderResult } from './componentHarness'
import { createComponentEvents } from './componentHarness/events'
import { COMPONENT_HOST_ROUTE, createComponentHostProject } from './componentHarness/host'
import { applyWxMock } from './host'
import { MiniProgramScreen } from './screen'
import { MiniProgramUser } from './user'

function formatDiagnostic(entry: RuntimeDiagnosticEntry) {
  return entry.args.map((arg) => {
    if (arg && typeof arg === 'object' && 'message' in arg && typeof arg.message === 'string') {
      return 'stack' in arg && typeof arg.stack === 'string' ? arg.stack : arg.message
    }
    return typeof arg === 'string' ? arg : JSON.stringify(arg)
  }).join(' ')
}

export class MiniProgramTestProject {
  private readonly baseProject: HeadlessProjectDescriptor
  private readonly renders = new Set<MiniProgramRenderResult>()

  constructor(private readonly options: CreateTestProjectOptions) {
    if (options.platform && options.platform.name !== 'wechat') {
      throw new Error(`Unsupported mini-program test platform: ${options.platform.name}`)
    }
    this.baseProject = options.artifact.miniprogramRootPath
      ? createArtifactProject({
          appConfigPath: options.artifact.appConfigPath,
          miniprogramRootPath: options.artifact.miniprogramRootPath,
          projectPath: options.artifact.projectPath,
        })
      : loadProject(options.artifact.projectPath)
  }

  private async render(project: HeadlessProjectDescriptor, route: string, events = createComponentEvents()) {
    const session = createHeadlessSession({
      globals: {
        __mpcoreRecordEvent(eventName: string, detail: unknown, event: Record<string, any>) {
          events.receive(eventName, detail, event)
        },
      },
      project,
      strictHostMocks: true,
    })
    applyWxMock(session, this.options.host)
    const pageInstance = session.reLaunch(route)
    const page = new HeadlessTestingPageHandle(project, pageInstance, session)
    const screen = new MiniProgramScreen(page, await page.snapshot())
    const assertDiagnostics = () => {
      const errors = session.getDiagnostics().filter((entry) => {
        return entry.level === 'exception'
          || (entry.level === 'error' && this.options.failOnConsoleError !== false)
      })
      if (errors.length > 0) {
        throw new Error(`Mini-program runtime reported errors:\n${errors.map(formatDiagnostic).join('\n')}`)
      }
    }
    const settle = async () => {
      await Promise.resolve()
      await Promise.resolve()
      assertDiagnostics()
    }
    const user = new MiniProgramUser(page, screen, settle)
    let closed = false
    const result: MiniProgramRenderResult = {
      close: async () => {
        if (closed) {
          return
        }
        closed = true
        try {
          session.close()
        }
        finally {
          events.clear()
          this.renders.delete(result)
        }
        assertDiagnostics()
      },
      diagnostics: () => session.getDiagnostics(),
      emitted: events.emitted,
      page,
      screen,
      user,
    }
    this.renders.add(result)
    await settle()
    return { result, session, settle }
  }

  async renderPage(route: string) {
    return (await this.render(this.baseProject, route)).result
  }

  async renderComponent(componentPath: string, options: RenderComponentOptions = {}) {
    const events = createComponentEvents(options)
    const host = createComponentHostProject(this.baseProject, componentPath, options, events)
    const { result, session, settle } = await this.render(host.project, `/${COMPONENT_HOST_ROUTE}`, events)
    return createComponentRenderResult(result, session, settle, host, events)
  }

  async close() {
    let firstError: unknown
    for (const render of this.renders) {
      try {
        await render.close()
      }
      catch (error) {
        firstError ??= error
      }
    }
    this.renders.clear()
    if (firstError) {
      throw firstError
    }
  }
}

export function artifactFromProject(projectPath: string) {
  return { projectPath }
}

export function createTestProject(options: CreateTestProjectOptions) {
  return new MiniProgramTestProject({
    ...options,
    platform: options.platform ?? wechat(),
  })
}
