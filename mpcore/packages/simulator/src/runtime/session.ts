import type { HeadlessAppDefinition, HeadlessHostRegistries } from '../host'
import type { HeadlessProjectDescriptor } from '../project'
import type { HeadlessAppInstance } from './appInstance'
import type { HeadlessPageInstance } from './pageInstance'
import path from 'node:path'
import { createHostRegistries } from '../host'
import { loadProject } from '../project'
import { createAppInstance } from './appInstance'
import { createModuleLoader } from './moduleLoader'
import { createPageInstance } from './pageInstance'

export interface HeadlessSessionOptions {
  projectPath: string
}

const LEADING_SLASH_RE = /^\/+/

export class HeadlessSession {
  readonly project: HeadlessProjectDescriptor

  private appDefinition: HeadlessAppDefinition | null = null
  private appInstance: HeadlessAppInstance | null = null
  private readonly moduleLoader
  private readonly registries: HeadlessHostRegistries
  private currentPageInstance: HeadlessPageInstance | null = null
  private readonly pages: HeadlessPageInstance[] = []

  constructor(options: HeadlessSessionOptions) {
    this.project = loadProject(options.projectPath)
    this.registries = createHostRegistries()
    this.moduleLoader = createModuleLoader(
      this.registries,
      () => this.pages.slice(),
      () => this.getApp(),
    )
  }

  getApp() {
    return this.appInstance
  }

  getCurrentPages() {
    return this.pages.slice()
  }

  bootstrap() {
    if (this.appInstance) {
      return this.appInstance
    }

    const appModulePath = path.resolve(this.project.miniprogramRootPath, 'app.js')
    this.appDefinition = this.moduleLoader.executeAppModule(appModulePath)
    this.appInstance = createAppInstance(this.appDefinition)
    this.appInstance.onLaunch?.()
    this.appInstance.onShow?.()
    return this.appInstance
  }

  reLaunch(route: string) {
    this.bootstrap()

    const normalizedRoute = route.replace(LEADING_SLASH_RE, '')
    const routeRecord = this.project.routes.find(item => item.route === normalizedRoute)
    if (!routeRecord) {
      throw new Error(`Unknown route for headless runtime reLaunch(): ${route}`)
    }

    if (this.currentPageInstance) {
      this.currentPageInstance.onHide?.()
      this.currentPageInstance.onUnload?.()
      this.pages.length = 0
      this.currentPageInstance = null
    }

    const pageModulePath = path.resolve(this.project.miniprogramRootPath, `${routeRecord.route}.js`)
    const pageDefinition = this.moduleLoader.executePageModule(pageModulePath, routeRecord.route)
    const pageInstance = createPageInstance(`/${routeRecord.route}`, pageDefinition)
    this.pages.push(pageInstance)
    this.currentPageInstance = pageInstance
    pageInstance.onLoad?.()
    pageInstance.onShow?.()
    pageInstance.onReady?.()
    return pageInstance
  }
}

export function createHeadlessSession(options: HeadlessSessionOptions) {
  return new HeadlessSession(options)
}
