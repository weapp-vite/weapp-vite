/**
 * @file 小程序实例控制能力。
 */
import type Connection from './Connection'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import pkg from '../package.json'
import { cmpVersion, isFn, isStr, startWith, trim } from './internal/compat'
import Native from './Native'
import Page from './Page'
import { decodeQrCode, extractPluginId, isPluginPath, printQrCode } from './util'

interface IScreenshotOptions {
  path?: string
}
interface IAuditsOptions {
  path?: string
}
type AutomatorCallable = (...args: any[]) => any

const CLOSE_STEP_TIMEOUT = 2000

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    task
      .then((value) => {
        clearTimeout(timeout)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}
function isFnStr(value: unknown) {
  if (!isStr(value)) {
    return false
  }
  const trimmed = trim(value)
  return startWith(trimmed, 'function') || startWith(trimmed, '() =>')
}
/** MiniProgram 的实现。 */
export default class MiniProgram extends EventEmitter {
  private appBindings = new Map<string, AutomatorCallable>()
  private pageMap = new Map<number, Page>()
  private nativeIns?: Native
  constructor(private connection: Connection) {
    super()
    connection.on('App.logAdded', this.onLogAdded)
    connection.on('App.bindingCalled', this.onBindingCalled)
    connection.on('App.exceptionThrown', this.onExceptionThrown)
  }

  async pageStack() {
    const { pageStack } = await this.send('App.getPageStack')
    return pageStack.map((page: {
      pageId: number
      path: string
      query: any
    }) => {
      return Page.create(this.connection, {
        id: page.pageId,
        path: page.path,
        query: page.query,
      }, this.pageMap)
    })
  }

  async navigateTo(url: string) {
    return await this.changeRoute('navigateTo', url)
  }

  async redirectTo(url: string) {
    return await this.changeRoute('redirectTo', url)
  }

  async navigateBack() {
    return await this.changeRoute('navigateBack')
  }

  async reLaunch(url: string) {
    return await this.changeRoute('reLaunch', url)
  }

  async switchTab(url: string) {
    return await this.changeRoute('switchTab', url)
  }

  async currentPage() {
    const { pageId, path, query } = await this.send('App.getCurrentPage')
    return Page.create(this.connection, { id: pageId, path, query }, this.pageMap)
  }

  async systemInfo() {
    return await this.callWxMethod('getSystemInfoSync')
  }

  async callWxMethod(method: string, ...args: any[]) {
    return (await this.send('App.callWxMethod', { method, args })).result
  }

  async mockWxMethod(method: string, result: any, ...args: any[]) {
    if (isFn(result) || isFnStr(result)) {
      await this.send('App.mockWxMethod', {
        method,
        functionDeclaration: result.toString(),
        args,
      })
      return
    }
    await this.send('App.mockWxMethod', { method, result })
  }

  async restoreWxMethod(method: string) {
    await this.send('App.mockWxMethod', { method })
  }

  async callPluginWxMethod(pluginId: string, method: string, ...args: any[]) {
    return (await this.send('App.callWxMethod', { method, pluginId, args })).result
  }

  async mockPluginWxMethod(pluginId: string, method: string, result: any, ...args: any[]) {
    if (isFn(result) || isFnStr(result)) {
      await this.send('App.mockWxMethod', {
        method,
        pluginId,
        functionDeclaration: result.toString(),
        args,
      })
      return
    }
    await this.send('App.mockWxMethod', { method, pluginId, result })
  }

  async restorePluginWxMethod(pluginId: string, method: string) {
    await this.send('App.mockWxMethod', { method, pluginId })
  }

  async evaluate(appFunction: AutomatorCallable | string, ...args: any[]) {
    const { result } = await this.send('App.callFunction', {
      functionDeclaration: appFunction.toString(),
      args,
    })
    return result
  }

  async pageScrollTo(scrollTop: number) {
    await this.callWxMethod('pageScrollTo', {
      scrollTop,
      duration: 0,
    })
  }

  async close() {
    try {
      await withTimeout(this.send('App.exit'), CLOSE_STEP_TIMEOUT)
    }
    catch {
    }
    await sleep(1000)
    try {
      await withTimeout(this.send('Tool.close'), CLOSE_STEP_TIMEOUT)
    }
    catch {
    }
    finally {
      this.disconnect()
    }
  }

  async remote(auto = false) {
    const { qrCode } = await this.send('Tool.enableRemoteDebug', { auto })
    if (qrCode) {
      await printQrCode(await decodeQrCode(qrCode))
    }
    return new Promise<void>((resolve) => {
      this.connection.once('Tool.onRemoteDebugConnected', async () => {
        await sleep(1000)
        resolve()
      })
    })
  }

  disconnect() {
    this.connection.dispose()
  }

  override on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (event === 'console') {
      void this.send('App.enableLog')
    }
    super.on(event, listener)
    return this
  }

  async exposeFunction(name: string, bindingFunction: AutomatorCallable) {
    if (this.appBindings.has(name)) {
      throw new Error(`Failed to expose function with name ${name}: already exists!`)
    }
    this.appBindings.set(name, bindingFunction)
    await this.send('App.addBinding', { name })
  }

  async checkVersion() {
    const sdkVersion = (await this.send('Tool.getInfo')).SDKVersion
    if (sdkVersion !== 'dev' && cmpVersion(sdkVersion, '2.7.3') < 0) {
      throw new Error(`SDKVersion is currently ${sdkVersion}, while automator(${pkg.version}) requires at least version 2.7.3`)
    }
  }

  async screenshot(options: IScreenshotOptions = {}) {
    const { data } = await this.send('App.captureScreenshot')
    if (!options.path) {
      return data
    }
    await fs.writeFile(options.path, data, 'base64')
  }

  async testAccounts() {
    return (await this.send('Tool.getTestAccounts')).accounts
  }

  async stopAudits(options: IAuditsOptions = {}) {
    const result = await this.send('Tool.stopAudits')
    if (options.path) {
      await fs.writeFile(options.path, result.report, 'utf8')
    }
    return JSON.parse(result.data)
  }

  async getTicket() {
    return await this.send('Tool.getTicket')
  }

  async setTicket(ticket: string) {
    await this.send('Tool.setTicket', { ticket })
  }

  async refreshTicket() {
    await this.send('Tool.refreshTicket')
  }

  native() {
    if (!this.nativeIns) {
      this.nativeIns = new Native(this.connection)
    }
    return this.nativeIns
  }

  private async changeRoute(method: string, url?: string) {
    const currentPage = await this.currentPage()
    if (currentPage && isPluginPath(currentPage.path)) {
      const pluginId = extractPluginId(currentPage.path)
      await this.callPluginWxMethod(pluginId, method, { url })
    }
    else {
      await this.callWxMethod(method, { url })
    }
    await sleep(3000)
    return await this.currentPage()
  }

  private async send(method: string, params: Record<string, any> = {}) {
    return await this.connection.send(method, params)
  }

  private onLogAdded = (payload: any) => {
    this.emit('console', payload)
  }

  private onBindingCalled = (payload: {
    name: string
    args: any[]
  }) => {
    const binding = this.appBindings.get(payload.name)
    if (!binding) {
      return
    }
    try {
      binding(...payload.args)
    }
    catch {
    }
  }

  private onExceptionThrown = (payload: any) => {
    this.emit('exception', payload)
  }
}
