import type { HeadlessTestingPageHandle } from '../pageHandle'
import { HEADLESS_PROTOCOL_UNSUPPORTED } from '@weapp-core/constants'
import { cloneProtocolValue, runWithTimeout } from './shared'

export interface HeadlessTestingProtocolOptions {
  timeout?: number
}

export type HeadlessTestingEvaluator<T = unknown> = ((...args: any[]) => T | PromiseLike<T>) | string

export interface HeadlessTestingToolInfo {
  version: 'mpcore-simulator'
}

interface ProtocolTarget {
  currentPage: () => Promise<HeadlessTestingPageHandle | null>
  getCurrentPages: () => Promise<HeadlessTestingPageHandle[]>
  toolInfo: () => Promise<HeadlessTestingToolInfo>
  evaluateWithOptions: (evaluator: HeadlessTestingEvaluator, options: HeadlessTestingProtocolOptions, ...args: any[]) => Promise<unknown>
  callWxMethodWithOptions: (method: string, options: HeadlessTestingProtocolOptions, ...args: any[]) => Promise<unknown>
  on: (event: string, listener: (...args: any[]) => void) => unknown
  off: (event: string, listener: (...args: any[]) => void) => unknown
}

/** 无头协议只公布已有运行时语义；不把宿主缺失能力伪装为调试器结果。 */
export class HeadlessTestingProtocolUnsupportedError extends Error {
  readonly code = HEADLESS_PROTOCOL_UNSUPPORTED

  constructor(readonly method: string) {
    super(`Protocol method ${method} is not supported by the headless testing runtime.`)
    this.name = 'HeadlessTestingProtocolUnsupportedError'
  }
}

function requireString(params: Record<string, unknown>, name: string) {
  const value = params[name]
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Protocol parameter ${name} must be a non-empty string.`)
  }
  return value
}

function readArgs(params: Record<string, unknown>) {
  if (params.args === undefined) {
    return []
  }
  if (!Array.isArray(params.args)) {
    throw new TypeError('Protocol parameter args must be an array.')
  }
  return cloneProtocolValue(params.args)
}

function pageSnapshot(page: HeadlessTestingPageHandle) {
  return { pageId: page.pageId, path: page.path, query: page.query }
}

async function dispatch(target: ProtocolTarget, method: string, params: Record<string, unknown>) {
  switch (method) {
    case 'Tool.getInfo':
      return await target.toolInfo()
    case 'App.getCurrentPage': {
      const page = await target.currentPage()
      return page ? pageSnapshot(page) : null
    }
    case 'App.getPageStack':
      return { pageStack: (await target.getCurrentPages()).map(pageSnapshot) }
    case 'App.callFunction':
      return { result: cloneProtocolValue(await target.evaluateWithOptions(requireString(params, 'functionDeclaration'), {}, ...readArgs(params))) }
    case 'App.callWxMethod':
      return { result: cloneProtocolValue(await target.callWxMethodWithOptions(requireString(params, 'method'), {}, ...readArgs(params))) }
    default:
      throw new HeadlessTestingProtocolUnsupportedError(method)
  }
}

export async function sendHeadlessTestingProtocol<T>(
  target: ProtocolTarget,
  method: string,
  params: Record<string, unknown>,
  options: HeadlessTestingProtocolOptions,
): Promise<T> {
  let rejectClosed!: (error: Error) => void
  const closed = new Promise<never>((_resolve, reject) => {
    rejectClosed = reject
  })
  const onClose = () => rejectClosed(new Error(`The headless testing session closed before protocol method ${method} completed.`))
  target.on('close', onClose)
  try {
    return await runWithTimeout(
      () => Promise.race([dispatch(target, method, params), closed]) as Promise<T>,
      options.timeout,
      `Timed out executing protocol method ${method} in headless testing runtime.`,
    )
  }
  finally {
    target.off('close', onClose)
  }
}
