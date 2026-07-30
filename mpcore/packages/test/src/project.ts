import type { HeadlessProjectDescriptor, RuntimeDiagnosticEntry } from '@mpcore/simulator'
import type {
  CreateTestProjectOptions,
  MiniProgramRenderResult,
  RenderComponentOptions,
} from './types'
import path from 'node:path'
import {
  createArtifactProject,
  createHeadlessSession,
  createMemoryArtifactSource,
  createOverlayArtifactSource,
  createProjectDescriptor,
  HeadlessTestingPageHandle,
  loadProject,
  wechat,
} from '@mpcore/simulator'
import { applyWxMock } from './host'
import { MiniProgramScreen } from './screen'
import { MiniProgramUser } from './user'

const COMPONENT_HOST_ROUTE = '__mpcore__/component-host/index'

function normalizeComponentPath(componentPath: string) {
  return componentPath
    .trim()
    .replace(/^\/+/, '')
    .replace(/\.(?:js|json|wxml)$/, '')
}

function serializeProperties(properties: Record<string, unknown>) {
  try {
    return JSON.stringify(properties).replaceAll('<', '\\u003c')
  }
  catch (error) {
    throw new TypeError('Component properties must be serializable.', { cause: error })
  }
}

function createSlotMarkup(slots: Record<string, string>) {
  return Object.entries(slots).map(([name, content]) => {
    return name === 'default' ? content : `<block slot="${name}">${content}</block>`
  }).join('')
}

function createComponentHostProject(
  project: HeadlessProjectDescriptor,
  componentPath: string,
  options: RenderComponentOptions,
) {
  const root = project.miniprogramRootPath
  const eventEntries = Object.keys(options.on ?? {}).map((eventName, index) => ({
    eventName,
    methodName: `__mpcoreEvent${index}`,
  }))
  const eventMethods = eventEntries.map(({ eventName, methodName }) => {
    return `${methodName}(event) { globalThis.__mpcoreRecordEvent(${JSON.stringify(eventName)}, event?.detail, event) }`
  }).join(',\n')
  const propertyBindings = Object.keys(options.properties ?? {})
    .map(key => `${key}="{{__mpcoreProperties.${key}}}"`)
    .join(' ')
  const eventBindings = eventEntries
    .map(({ eventName, methodName }) => `bind:${eventName}="${methodName}"`)
    .join(' ')
  const hostRoot = path.resolve(root, COMPONENT_HOST_ROUTE)
  const overlay = createMemoryArtifactSource([
    [path.resolve(root, 'app.json'), JSON.stringify({ pages: [COMPONENT_HOST_ROUTE] })],
    [path.resolve(root, 'app.js'), 'App({})\n'],
    [`${hostRoot}.json`, JSON.stringify({
      usingComponents: {
        'mpcore-subject': `/${normalizeComponentPath(componentPath)}`,
      },
    })],
    [`${hostRoot}.js`, `Page({
  data: { __mpcoreProperties: ${serializeProperties(options.properties ?? {})} },
  ${eventMethods}
})\n`],
    [`${hostRoot}.wxml`, `<mpcore-subject id="mpcore-subject" ${propertyBindings} ${eventBindings}>${createSlotMarkup(options.slots ?? {})}</mpcore-subject>`],
  ])
  return createProjectDescriptor({
    appConfig: { pages: [COMPONENT_HOST_ROUTE] },
    appConfigPath: path.resolve(root, 'app.json'),
    artifactSource: createOverlayArtifactSource(overlay, project.artifactSource),
    miniprogramRoot: project.miniprogramRoot,
    miniprogramRootPath: root,
    projectConfigFiles: project.projectConfigFiles,
    projectPath: project.projectPath,
  })
}

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

  private async render(project: HeadlessProjectDescriptor, route: string, on: RenderComponentOptions['on'] = {}) {
    const eventLog = new Map<string, unknown[]>()
    const session = createHeadlessSession({
      globals: {
        __mpcoreRecordEvent(eventName: string, detail: unknown, event: Record<string, any>) {
          const entries = eventLog.get(eventName) ?? []
          entries.push(detail)
          eventLog.set(eventName, entries)
          on?.[eventName]?.(detail, event)
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
        session.close()
        this.renders.delete(result)
        assertDiagnostics()
      },
      diagnostics: () => session.getDiagnostics(),
      emitted: eventName => [...(eventLog.get(eventName) ?? [])],
      page,
      screen,
      user,
    }
    this.renders.add(result)
    await settle()
    return result
  }

  async renderPage(route: string) {
    return await this.render(this.baseProject, route)
  }

  async renderComponent(componentPath: string, options: RenderComponentOptions = {}) {
    const project = createComponentHostProject(this.baseProject, componentPath, options)
    return await this.render(project, `/${COMPONENT_HOST_ROUTE}`, options.on)
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
