/* eslint-disable ts/no-use-before-define */
import type {
  DevtoolsRuntimeHooks,
} from '@weapp-vite/devtools-runtime'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import {
  acquireSharedMiniProgram,
  closeSharedMiniProgram,
  releaseSharedMiniProgram,
} from '@weapp-vite/devtools-runtime'
import { z } from 'zod'

export interface MiniProgramElement {
  tagName?: string
  $?: (selector: string) => Promise<MiniProgramElement | null>
  $$?: (selector: string) => Promise<MiniProgramElement[]>
  tap: () => Promise<void>
}

export interface MiniProgramPage {
  path: string
  query?: unknown
  $: (selector: string) => Promise<MiniProgramElement | null>
  $$?: (selector: string) => Promise<MiniProgramElement[]>
  data: (path?: string) => Promise<unknown>
  size: () => Promise<unknown>
  scrollTop: () => Promise<unknown>
  waitFor: (milliseconds: number) => Promise<void>
}

export interface MiniProgramLike {
  on: (name: 'console' | 'exception', handler: (payload: unknown) => void) => void
  off?: (name: 'console' | 'exception', handler: (payload: unknown) => void) => void
  currentPage: () => Promise<MiniProgramPage>
  systemInfo: () => Promise<unknown>
  pageStack: () => Promise<MiniProgramPage[]>
  navigateTo: (url: string) => Promise<MiniProgramPage>
  redirectTo: (url: string) => Promise<MiniProgramPage>
  reLaunch: (url: string) => Promise<MiniProgramPage>
  switchTab: (url: string) => Promise<MiniProgramPage>
  navigateBack: () => Promise<MiniProgramPage>
  screenshot: () => Promise<string | Uint8Array>
  callWxMethod: (method: string, ...args: unknown[]) => Promise<unknown>
}

export interface RuntimeConnectionInput {
  projectPath: string
  timeout?: number
  preferOpenedSession?: boolean
}

export interface RuntimeToolOptions {
  manager?: RuntimeSessionManager
  workspaceRoot: string
  runtimeHooks?: DevtoolsRuntimeHooks
}

export interface RuntimeConsoleLogEntry {
  level: string
  message: string
  timestamp: number
  raw: unknown
}

interface AttachedSession {
  miniProgram: MiniProgramLike
  onConsole: (payload: unknown) => void
  onException: (payload: unknown) => void
}

export const connectionSchema = z.object({
  projectPath: z.string().trim().min(1).describe('小程序项目路径；支持 workspaceRoot 相对路径'),
  timeout: z.number().int().positive().optional(),
  preferOpenedSession: z.boolean().optional(),
})

export const connectionInputSchema = {
  projectPath: z.string().trim().min(1).describe('小程序项目路径；支持 workspaceRoot 相对路径'),
  timeout: z.number().int().positive().optional(),
  preferOpenedSession: z.boolean().optional(),
}

export class RuntimeSessionManager {
  private readonly logs: RuntimeConsoleLogEntry[] = []
  private readonly attachedSessions = new Map<string, AttachedSession>()
  private readonly maxLogs = 1000

  constructor(
    private readonly workspaceRoot: string,
    private readonly runtimeHooks: DevtoolsRuntimeHooks = createUnavailableRuntimeHooks(),
  ) {}

  async close(input: RuntimeConnectionInput) {
    const projectPath = this.resolveProjectPath(input.projectPath)
    this.detach(projectPath)
    await closeSharedMiniProgram(projectPath)
  }

  clearLogs() {
    this.logs.length = 0
  }

  getLogs() {
    return [...this.logs]
  }

  resolveProjectPath(projectPath: string) {
    return path.isAbsolute(projectPath)
      ? path.normalize(projectPath)
      : path.resolve(this.workspaceRoot, projectPath)
  }

  resolveWorkspacePath(filePath: string) {
    return path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.resolve(this.workspaceRoot, filePath)
  }

  async withMiniProgram<T>(
    input: RuntimeConnectionInput,
    runner: (miniProgram: MiniProgramLike) => Promise<T>,
  ): Promise<T> {
    const projectPath = this.resolveProjectPath(input.projectPath)
    const miniProgram = await acquireSharedMiniProgram(this.runtimeHooks, {
      projectPath,
      timeout: input.timeout,
      preferOpenedSession: input.preferOpenedSession,
      sharedSession: true,
    })

    this.attach(projectPath, miniProgram)

    try {
      return await runner(miniProgram)
    }
    catch (error) {
      this.detach(projectPath)
      await closeSharedMiniProgram(projectPath)
      throw error
    }
    finally {
      releaseSharedMiniProgram(projectPath)
    }
  }

  async withPage<T>(
    input: RuntimeConnectionInput,
    runner: (page: MiniProgramPage, miniProgram: MiniProgramLike) => Promise<T>,
  ): Promise<T> {
    return await this.withMiniProgram(input, async (miniProgram) => {
      const page = await miniProgram.currentPage()
      if (!page) {
        throw new Error('当前没有活动页面，请先调用 weapp_devtools_connect 确认 DevTools 会话。')
      }
      return await runner(page, miniProgram)
    })
  }

  private attach(projectPath: string, miniProgram: MiniProgramLike) {
    const existing = this.attachedSessions.get(projectPath)
    if (existing?.miniProgram === miniProgram) {
      return
    }

    this.detach(projectPath)

    const onConsole = (payload: unknown) => {
      this.pushLog(normalizeConsoleEvent(payload))
    }
    const onException = (payload: unknown) => {
      this.pushLog(normalizeExceptionEvent(payload))
    }

    miniProgram.on('console', onConsole)
    miniProgram.on('exception', onException)
    this.attachedSessions.set(projectPath, {
      miniProgram,
      onConsole,
      onException,
    })
  }

  private detach(projectPath: string) {
    const attached = this.attachedSessions.get(projectPath)
    if (!attached) {
      return
    }

    if (typeof attached.miniProgram.off === 'function') {
      attached.miniProgram.off('console', attached.onConsole)
      attached.miniProgram.off('exception', attached.onException)
    }

    this.attachedSessions.delete(projectPath)
  }

  private pushLog(entry: RuntimeConsoleLogEntry) {
    this.logs.push(entry)
    while (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
  }
}

export function buildUrl(pagePath: string, query?: Record<string, string>) {
  const normalizedPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`
  if (!query || Object.keys(query).length === 0) {
    return normalizedPath
  }

  const search = new URLSearchParams(query).toString()
  if (!search) {
    return normalizedPath
  }

  return `${normalizedPath}${normalizedPath.includes('?') ? '&' : '?'}${search}`
}

export function parseSelectorWithIndex(selector: string) {
  const match = selector.match(/^(.+?)\[index=(\d+)\]$/)
  if (!match?.[1] || !match[2]) {
    return {
      selector,
      index: undefined,
    }
  }

  return {
    selector: match[1],
    index: Number.parseInt(match[2], 10),
  }
}

export async function resolveElement(
  page: MiniProgramPage,
  selectorInput: string,
  innerSelector?: string,
): Promise<MiniProgramElement> {
  const { selector, index } = parseSelectorWithIndex(selectorInput)
  let element: MiniProgramElement | undefined | null

  if (index === undefined) {
    element = await page.$(selector) as MiniProgramElement | null
  }
  else {
    const elements = await queryElements(page, selector)
    if (index < 0 || index >= elements.length) {
      throw new Error(`选择器 "${selector}" 的 index=${index} 超出范围，当前匹配 ${elements.length} 个元素。`)
    }
    element = elements[index]
  }

  if (!element) {
    throw new Error(`未找到元素: ${selectorInput}`)
  }

  if (!innerSelector) {
    return element
  }

  const inner = await callOptionalMethod<MiniProgramElement | null>(element, '$', innerSelector)
  if (!inner) {
    throw new Error(`在元素 "${selectorInput}" 内未找到元素: ${innerSelector}`)
  }

  return inner
}

export async function queryElements(page: MiniProgramPage, selectorInput: string) {
  const { selector, index } = parseSelectorWithIndex(selectorInput)
  const elements = await callOptionalMethod<MiniProgramElement[]>(page, '$$', selector)
  if (!Array.isArray(elements)) {
    return []
  }

  if (index === undefined) {
    return elements
  }

  if (index < 0 || index >= elements.length) {
    throw new Error(`选择器 "${selector}" 的 index=${index} 超出范围，当前匹配 ${elements.length} 个元素。`)
  }

  return [elements[index]!]
}

export async function summarizeElement(element: MiniProgramElement, withWxml = false) {
  const [text, value, size, offset, scrollWidth, scrollHeight, outerWxml] = await Promise.all([
    callMaybe(element, 'text'),
    callMaybe(element, 'value'),
    callMaybe(element, 'size'),
    callMaybe(element, 'offset'),
    callMaybe(element, 'scrollWidth'),
    callMaybe(element, 'scrollHeight'),
    withWxml ? callMaybe(element, 'outerWxml') : Promise.resolve(undefined),
  ])

  return compactObject({
    tagName: readProperty(element, 'tagName'),
    text,
    value,
    size,
    offset,
    scrollWidth,
    scrollHeight,
    outerWxml,
  })
}

export function toSerializableValue(value: unknown): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('base64')
  }
  if (Array.isArray(value)) {
    return value.map(item => toSerializableValue(item))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toSerializableValue(item)]))
  }
  return String(value)
}

export async function callRequiredMethod<TResult>(
  target: unknown,
  methodName: string,
  ...args: unknown[]
): Promise<TResult> {
  const method = readProperty(target, methodName)
  if (typeof method !== 'function') {
    throw new TypeError(`当前对象不支持 ${methodName} 方法。`)
  }
  return await method.apply(target, args) as TResult
}

export async function callOptionalMethod<TResult>(
  target: unknown,
  methodName: string,
  ...args: unknown[]
): Promise<TResult | undefined> {
  const method = readProperty(target, methodName)
  if (typeof method !== 'function') {
    return undefined
  }
  return await method.apply(target, args) as TResult
}

export async function callMaybe(target: unknown, methodName: string, ...args: unknown[]) {
  try {
    return await callOptionalMethod(target, methodName, ...args)
  }
  catch {
    return undefined
  }
}

export function compactObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
}

export function readProperty(target: unknown, key: string): unknown {
  if (!target || typeof target !== 'object') {
    return undefined
  }
  return (target as Record<string, unknown>)[key]
}

function normalizeConsoleEvent(payload: unknown): RuntimeConsoleLogEntry {
  const record = toRecord(payload)
  return {
    level: normalizeLogLevel(record.type ?? record.level ?? record.method),
    message: resolveLogMessage(record, payload),
    timestamp: Date.now(),
    raw: toSerializableValue(payload),
  }
}

function normalizeExceptionEvent(payload: unknown): RuntimeConsoleLogEntry {
  const record = toRecord(payload)
  const error = toRecord(record.error)
  const message = [
    typeof error.message === 'string' ? error.message : undefined,
    typeof record.message === 'string' ? record.message : undefined,
    typeof error.stack === 'string' ? error.stack : undefined,
    typeof record.stack === 'string' ? record.stack : undefined,
  ].filter(Boolean).join('\n')

  return {
    level: 'error',
    message: message || JSON.stringify(toSerializableValue(payload)),
    timestamp: Date.now(),
    raw: toSerializableValue(payload),
  }
}

function normalizeLogLevel(value: unknown) {
  const normalized = String(value ?? 'log').toLowerCase()
  if (normalized === 'warning') {
    return 'warn'
  }
  if (['debug', 'log', 'info', 'warn', 'error'].includes(normalized)) {
    return normalized
  }
  return 'log'
}

function resolveLogMessage(record: Record<string, unknown>, payload: unknown) {
  if (typeof record.text === 'string' && record.text) {
    return record.text
  }
  if (typeof record.message === 'string' && record.message) {
    return record.message
  }
  if (Array.isArray(record.args)) {
    return record.args.map(formatLogArgument).join(' ')
  }
  if (typeof payload === 'string') {
    return payload
  }
  return JSON.stringify(toSerializableValue(payload))
}

function formatLogArgument(value: unknown) {
  const record = toRecord(value)
  if (record.value !== undefined) {
    return typeof record.value === 'string' ? record.value : JSON.stringify(toSerializableValue(record.value))
  }
  if (typeof record.description === 'string') {
    return record.description
  }
  return typeof value === 'string' ? value : JSON.stringify(toSerializableValue(value))
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function createUnavailableRuntimeHooks(): DevtoolsRuntimeHooks {
  return {
    async connectMiniProgram() {
      throw new Error('未配置 DevTools runtime hooks。请通过 createWeappViteMcpServer({ runtimeHooks }) 注入 automator 连接能力。')
    },
  }
}
