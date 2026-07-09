/**
 * @file 小程序实例控制能力。
 */
import type Connection from './Connection'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import process from 'node:process'
import pkg from '../package.json'
import { cmpVersion, isFn, isStr, startWith, trim } from './internal/compat'
import Native from './Native'
import Page from './Page'
import { decodeQrCode, extractPluginId, isPluginPath, printQrCode } from './util'

interface IScreenshotOptions {
  path?: string
  timeout?: number
}
interface IAuditsOptions {
  path?: string
}
interface IToolCompileOptions {
  force?: boolean
}
interface IToolClearCacheOptions {
  clean: 'all' | 'auth' | 'compile' | 'file' | 'network' | 'session' | 'storage'
}
type AutomatorCallable = (...args: any[]) => any
interface CurrentPageOptions {
  appFunctionFallback?: boolean
  retries?: number
  timeout?: number
}
interface EvaluateOptions {
  timeout?: number
}
interface ProtocolPagePayload {
  __route__?: string
  __webviewId__?: number
  __wxWebviewId__?: number
  options?: any
  pageId?: number
  path?: string
  query?: any
  route?: string
}

const CLOSE_STEP_TIMEOUT = 2000
const CURRENT_PAGE_RETRIES = 3
const CURRENT_PAGE_RETRY_DELAY = 400
const CHANGE_ROUTE_CONTEXT_TIMEOUT = 12_000
const CHANGE_ROUTE_CALL_TIMEOUT = 12_000
const CHANGE_ROUTE_READY_TIMEOUT = 15_000
const CHANGE_ROUTE_POLL_DELAY = 500
const CHANGE_ROUTE_POLL_PROTOCOL_TIMEOUT = 2_500
const CHANGE_ROUTE_APP_FUNCTION_TIMEOUT = 15_000
const CHANGE_ROUTE_APP_FUNCTION_RETRIES = 2
const CHANGE_ROUTE_APP_FUNCTION_RETRY_DELAY = 800
const APP_READY_TIMEOUT = 20_000
const APP_READY_PROBE_TIMEOUT = 3_000
const APP_READY_POLL_DELAY = 500
const SCREENSHOT_RETRIES = 2
const SCREENSHOT_RETRY_DELAY = 500
const CHANGE_ROUTE_DEBUG_ENABLED = process.env.WEAPP_VITE_E2E_CHANGE_ROUTE_DEBUG === '1'

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

function isOperationTimeoutError(error: unknown, timeoutMs: number) {
  return error instanceof Error && error.message.includes(`Operation timed out after ${timeoutMs}ms`)
}
function isFnStr(value: unknown) {
  if (!isStr(value)) {
    return false
  }
  const trimmed = trim(value)
  return startWith(trimmed, 'function') || startWith(trimmed, '() =>')
}

function isCurrentPageProtocolTimeout(error: unknown) {
  return error instanceof Error
    && 'code' in error
    && error.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && 'method' in error
    && error.method === 'App.getCurrentPage'
}

function isPageStackProtocolTimeout(error: unknown) {
  return error instanceof Error
    && 'code' in error
    && error.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && 'method' in error
    && error.method === 'App.getPageStack'
}

function isCallFunctionProtocolTimeout(error: unknown) {
  return error instanceof Error
    && 'code' in error
    && error.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && 'method' in error
    && error.method === 'App.callFunction'
}

function isPageMetaMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('getPageMetaByWebviewId')
    && message.includes('rawPath')
    && message.includes('is null')
}

function isCurrentFrameTimedOutError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('unexpected current frame status timedout')
    || message.includes('[loader] unexpected current frame status timedout')
}

function isCallWxMethodProtocolTimeout(error: unknown) {
  return error instanceof Error
    && 'code' in error
    && error.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && 'method' in error
    && error.method === 'App.callWxMethod'
}

function isCaptureScreenshotRecoverableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  if (
    'code' in error
    && error.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && 'method' in error
    && error.method === 'App.captureScreenshot'
  ) {
    return true
  }

  return error.message.includes('fail to capture screenshot')
    || error.message.includes('App.captureScreenshot')
}

function isRouteContextProbeError(error: unknown) {
  return isCurrentPageProtocolTimeout(error)
    || isPageStackProtocolTimeout(error)
    || isPageMetaMissingError(error)
    || isCurrentFrameTimedOutError(error)
}

function isRoutePollingRecoverableError(error: unknown) {
  return isRouteContextProbeError(error)
    || isCallFunctionProtocolTimeout(error)
    || isPageStackProtocolTimeout(error)
    || isPageMetaMissingError(error)
}

function resolveAppFunctionTimeout(timeout: number | undefined) {
  return Math.max(timeout ?? CHANGE_ROUTE_APP_FUNCTION_TIMEOUT, CHANGE_ROUTE_APP_FUNCTION_TIMEOUT)
}

function normalizeRoutePath(value: string | undefined) {
  return String(value ?? '')
    .split('?', 1)[0]
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

function parseRouteQuery(value: string | undefined) {
  const queryText = String(value ?? '').split('?', 2)[1] ?? ''
  const query: Record<string, string> = {}
  if (!queryText) {
    return query
  }
  for (const part of queryText.split('&')) {
    if (!part) {
      continue
    }
    const [rawKey, rawValue = ''] = part.split('=', 2)
    if (!rawKey) {
      continue
    }
    query[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue)
  }
  return query
}

function resolvePagePayloadId(page: ProtocolPagePayload, fallbackId: number) {
  return page.pageId
    ?? page.__wxWebviewId__
    ?? page.__webviewId__
    ?? fallbackId
}

function resolvePagePayloadPath(page: ProtocolPagePayload) {
  return page.path ?? page.route ?? page.__route__ ?? ''
}

function logChangeRouteDebug(message: string) {
  if (!CHANGE_ROUTE_DEBUG_ENABLED) {
    return
  }
  process.stdout.write(`[automator:changeRoute] ${message}\n`)
}
/** MiniProgram 的实现。 */
export default class MiniProgram extends EventEmitter {
  private appBindings = new Map<string, AutomatorCallable>()
  private logEnabled = false
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

  async currentPage(options: CurrentPageOptions = {}) {
    let lastError: unknown
    const retries = options.retries ?? CURRENT_PAGE_RETRIES
    const sendOptions = options.timeout ? { timeout: options.timeout } : undefined
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const page = await this.send('App.getCurrentPage', {}, sendOptions) as ProtocolPagePayload
        return this.createPageFromPayload(page)
      }
      catch (error) {
        lastError = error
        if (!isCurrentPageProtocolTimeout(error) && !isPageMetaMissingError(error) && !isCurrentFrameTimedOutError(error)) {
          throw error
        }
        if (attempt < retries) {
          await sleep(CURRENT_PAGE_RETRY_DELAY)
          continue
        }
      }
    }

    if (isCurrentPageProtocolTimeout(lastError) || isPageMetaMissingError(lastError) || isCurrentFrameTimedOutError(lastError)) {
      try {
        const { pageStack } = await this.send('App.getPageStack', {}, sendOptions) as { pageStack: ProtocolPagePayload[] }
        const page = pageStack[pageStack.length - 1]
        if (page) {
          return this.createPageFromPayload(page, pageStack.length)
        }
      }
      catch (error) {
        if (!isPageStackProtocolTimeout(error) && !isPageMetaMissingError(error) && !isCurrentFrameTimedOutError(error)) {
          throw error
        }
      }
    }

    if ((options.appFunctionFallback ?? true) && (isCurrentPageProtocolTimeout(lastError) || isPageMetaMissingError(lastError) || isCurrentFrameTimedOutError(lastError))) {
      const pageStack = await this.readAppFunctionPageStack(resolveAppFunctionTimeout(sendOptions?.timeout))
      const page = pageStack[pageStack.length - 1]
      if (page) {
        return page
      }
    }

    throw lastError
  }

  async systemInfo() {
    return await this.callWxMethod('getSystemInfoSync')
  }

  async callWxMethod(method: string, ...args: any[]) {
    return (await this.send('App.callWxMethod', { method, args })).result
  }

  async callWxMethodWithOptions(method: string, options: { timeout?: number } = {}, ...args: any[]) {
    const sendOptions = options.timeout ? { timeout: options.timeout } : undefined
    return (await this.send('App.callWxMethod', { method, args }, sendOptions)).result
  }

  private async callWxMethodWithTimeout(method: string, timeout: number, ...args: any[]) {
    return (await this.send('App.callWxMethod', { method, args }, { timeout })).result
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
    return await this.evaluateWithOptions(appFunction, {}, ...args)
  }

  async evaluateWithOptions(appFunction: AutomatorCallable | string, options: EvaluateOptions = {}, ...args: any[]) {
    const sendOptions = options.timeout ? { timeout: options.timeout } : undefined
    const { result } = await this.send('App.callFunction', {
      functionDeclaration: appFunction.toString(),
      args,
    }, sendOptions)
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

  async enableLog() {
    await this.send('App.enableLog')
    this.logEnabled = true
  }

  override on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (event === 'console' && !this.logEnabled) {
      this.enableLog().catch(() => {})
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

  /**
   * @description 等待小程序 App 域协议可用，避免返回半就绪自动化会话。
   */
  async waitForAppReady(timeout = APP_READY_TIMEOUT) {
    const startedAt = Date.now()
    let lastError: unknown

    while (Date.now() - startedAt <= timeout) {
      try {
        await this.send('App.captureScreenshot', {}, {
          timeout: APP_READY_PROBE_TIMEOUT,
        })
        return
      }
      catch (error) {
        lastError = error
        await sleep(APP_READY_POLL_DELAY)
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Timed out waiting App domain readiness after ${timeout}ms`)
  }

  async screenshot(options: IScreenshotOptions = {}) {
    const sendOptions = options.timeout ? { timeout: options.timeout } : undefined
    let lastError: unknown
    let data: string

    for (let attempt = 1; attempt <= SCREENSHOT_RETRIES; attempt += 1) {
      try {
        const result = await this.send('App.captureScreenshot', {}, sendOptions)
        data = result.data
        if (!options.path) {
          return data
        }
        await fs.writeFile(options.path, data, 'base64')
        return
      }
      catch (error) {
        lastError = error
        if (!isCaptureScreenshotRecoverableError(error) || attempt === SCREENSHOT_RETRIES) {
          throw error
        }
        await sleep(SCREENSHOT_RETRY_DELAY)
      }
    }

    throw lastError
  }

  async testAccounts() {
    return (await this.send('Tool.getTestAccounts')).accounts
  }

  /**
   * @description 获取开发者工具 Tool 域基础信息。
   */
  async toolInfo() {
    return await this.send('Tool.getInfo')
  }

  /**
   * @description 触发开发者工具执行一次项目编译。
   */
  async compile(options: IToolCompileOptions = {}) {
    return await this.send('Tool.compile', options)
  }

  /**
   * @description 清理开发者工具缓存。
   */
  async clearCache(options: IToolClearCacheOptions) {
    return await this.send('Tool.clearCache', options)
  }

  /**
   * @description 调用开发者工具 Tool 域协议方法。
   */
  async tool(method: string, params: Record<string, any> = {}) {
    return await this.send(`Tool.${method}`, params)
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
    const currentPage = await this.resolveRouteContextPage()
    logChangeRouteDebug(`start method=${method} url=${url ?? '<none>'} current=${currentPage?.path ?? '<none>'}`)
    let routeCommandSent = false
    try {
      if (currentPage && isPluginPath(currentPage.path)) {
        await this.callPluginWxMethod(extractPluginId(currentPage.path), method, { url })
      }
      else {
        await this.callWxMethodWithTimeout(method, CHANGE_ROUTE_CALL_TIMEOUT, { url })
      }
      routeCommandSent = true
    }
    catch (error) {
      if (
        isCallWxMethodProtocolTimeout(error)
        || isOperationTimeoutError(error, CHANGE_ROUTE_CALL_TIMEOUT)
        || isPageMetaMissingError(error)
      ) {
        routeCommandSent = true
        logChangeRouteDebug(`call-timeout method=${method} url=${url ?? '<none>'}`)
      }
      else {
        throw error
      }
    }

    const expectedRoute = normalizeRoutePath(url)
    const expectedRouteQuery = parseRouteQuery(url)
    const startedAt = Date.now()
    let lastPage: Page | undefined
    let lastError: unknown

    while (Date.now() - startedAt <= CHANGE_ROUTE_READY_TIMEOUT) {
      try {
        const page = await this.readRoutePollingCurrentPage()
        lastPage = page
        logChangeRouteDebug(`poll method=${method} url=${url ?? '<none>'} current=${page?.path ?? '<none>'}`)
        if (!expectedRoute || normalizeRoutePath(page?.path) === expectedRoute) {
          logChangeRouteDebug(`ready method=${method} url=${url ?? '<none>'} current=${page?.path ?? '<none>'}`)
          return page
        }
      }
      catch (error) {
        lastError = error
        logChangeRouteDebug(`poll-error method=${method} url=${url ?? '<none>'} error=${error instanceof Error ? error.message : String(error)}`)
      }

      try {
        const stack = await this.readRoutePollingPageStack()
        const stackTop = stack[stack.length - 1]
        if (stackTop) {
          lastPage = stackTop
          logChangeRouteDebug(`stack method=${method} url=${url ?? '<none>'} current=${stackTop.path}`)
          if (!expectedRoute || normalizeRoutePath(stackTop.path) === expectedRoute) {
            logChangeRouteDebug(`stack-ready method=${method} url=${url ?? '<none>'} current=${stackTop.path}`)
            return stackTop
          }
        }
      }
      catch (error) {
        lastError = error
        logChangeRouteDebug(`stack-error method=${method} url=${url ?? '<none>'} error=${error instanceof Error ? error.message : String(error)}`)
        if (isOperationTimeoutError(error, CHANGE_ROUTE_CONTEXT_TIMEOUT) || isRoutePollingRecoverableError(error)) {
          await sleep(CHANGE_ROUTE_POLL_DELAY)
          continue
        }
      }
      await sleep(CHANGE_ROUTE_POLL_DELAY)
    }

    if (lastPage) {
      logChangeRouteDebug(`timeout method=${method} url=${url ?? '<none>'} current=${lastPage.path}`)
      throw new Error(`Timed out waiting route ${expectedRoute || '<current>'} after ${method}; current page: ${lastPage.path}`)
    }

    logChangeRouteDebug(`timeout method=${method} url=${url ?? '<none>'} current=<none> error=${lastError instanceof Error ? lastError.message : String(lastError)}`)
    if (isRoutePollingRecoverableError(lastError)) {
      if (routeCommandSent && expectedRoute) {
        return this.createPageFromPayload({
          pageId: 1,
          path: `/${expectedRoute}`,
          query: expectedRouteQuery,
        })
      }
      throw new Error(`Timed out waiting route ${expectedRoute || '<current>'} after ${method}; last recoverable error: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Timed out waiting route ${expectedRoute || '<current>'} after ${method}`)
  }

  private async resolveRouteContextPage() {
    const currentPageTask = this.currentPage({
      appFunctionFallback: false,
      retries: 1,
      timeout: CHANGE_ROUTE_POLL_PROTOCOL_TIMEOUT,
    })
      .catch((error) => {
        if (isRoutePollingRecoverableError(error)) {
          return undefined
        }
        throw error
      })
    const timeoutTask = sleep(CHANGE_ROUTE_CONTEXT_TIMEOUT).then(() => undefined)

    try {
      return await Promise.race([currentPageTask, timeoutTask])
    }
    finally {
      void currentPageTask.catch(() => {})
    }
  }

  private async readRoutePollingCurrentPage() {
    const page = await this.send('App.getCurrentPage', {}, {
      timeout: CHANGE_ROUTE_POLL_PROTOCOL_TIMEOUT,
    }) as ProtocolPagePayload
    return this.createPageFromPayload(page)
  }

  private async readRoutePollingPageStack() {
    try {
      const { pageStack } = await this.send('App.getPageStack', {}, {
        timeout: CHANGE_ROUTE_POLL_PROTOCOL_TIMEOUT,
      }) as { pageStack: ProtocolPagePayload[] }
      return this.createPagesFromPayloads(pageStack)
    }
    catch (error) {
      if (!isPageStackProtocolTimeout(error) && !isPageMetaMissingError(error)) {
        throw error
      }
      throw error
    }
  }

  private createPageFromPayload(page: ProtocolPagePayload, fallbackId = 1) {
    return Page.create(this.connection, {
      id: resolvePagePayloadId(page, fallbackId),
      path: resolvePagePayloadPath(page),
      query: page.query ?? page.options ?? {},
    }, this.pageMap)
  }

  private createPagesFromPayloads(pageStack: ProtocolPagePayload[]) {
    return pageStack.map((page, index) => this.createPageFromPayload(page, index + 1))
  }

  private async readAppFunctionPageStack(
    timeout = CHANGE_ROUTE_APP_FUNCTION_TIMEOUT,
    retries = CHANGE_ROUTE_APP_FUNCTION_RETRIES,
  ) {
    let lastError: unknown
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const { result } = await this.send('App.callFunction', {
          functionDeclaration: `function () {
            var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
            return pages.map(function (page, index) {
              return {
                pageId: page.pageId || page.__wxWebviewId__ || page.__webviewId__ || index + 1,
                path: page.path || page.route || page.__route__ || '',
                query: page.query || page.options || {}
              };
            });
          }`,
          args: [],
        }, {
          timeout,
        }) as { result: ProtocolPagePayload[] }
        return this.createPagesFromPayloads(Array.isArray(result) ? result : [])
      }
      catch (error) {
        lastError = error
        if (!isCallFunctionProtocolTimeout(error) || attempt >= retries) {
          throw error
        }
        await sleep(CHANGE_ROUTE_APP_FUNCTION_RETRY_DELAY)
      }
    }
    throw lastError
  }

  private async send(method: string, params: Record<string, any> = {}, options?: { timeout?: number }) {
    return options
      ? await this.connection.send(method, params, options)
      : await this.connection.send(method, params)
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
