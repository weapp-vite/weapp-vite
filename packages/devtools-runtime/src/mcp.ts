import type { Element, MiniProgram, Page } from '@weapp-vite/miniprogram-automator'
import { Buffer } from 'node:buffer'
import path from 'node:path'

export type AutomatorMiniProgram = InstanceType<typeof MiniProgram>
export type AutomatorPage = InstanceType<typeof Page>
export type AutomatorElement = InstanceType<typeof Element> & {
  input?: (value: string) => Promise<void>
}

export interface DevtoolsRuntimeSessionOptions {
  miniProgram?: AutomatorMiniProgram
  preferOpenedSession?: boolean
  projectPath: string
  sharedSession?: boolean
  timeout?: number
}

export interface DevtoolsRuntimeHooks {
  connectMiniProgram: (options: DevtoolsRuntimeSessionOptions) => Promise<AutomatorMiniProgram>
  normalizeConnectionError?: (error: unknown) => unknown
}

export interface DevtoolsConnectionInput {
  projectPath: string
  timeout?: number
  preferOpenedSession?: boolean
}

export interface DevtoolsElementSnapshot {
  selector: string
  tagName: string
  text: string | null
  value: unknown
  attributes: Record<string, unknown>
  styles: Record<string, unknown>
  offset: unknown
  size: unknown
  wxml: string | null
  outerWxml: string | null
}

export interface DevtoolsPageSnapshot {
  path: string
  query: unknown
  size: unknown
  scrollTop: unknown
  data: unknown
}

export interface DevtoolsContext {
  miniProgram: AutomatorMiniProgram
  page: AutomatorPage
}

export interface DevtoolsToolResult<T> {
  result: T
}

export interface MiniProgramElementLike {
  tagName?: string
  $?: (selector: string) => Promise<MiniProgramElementLike | null>
  $$?: (selector: string) => Promise<MiniProgramElementLike[]>
  attribute?: (name: string) => Promise<unknown>
  offset?: () => Promise<unknown>
  outerWxml?: () => Promise<unknown>
  size?: () => Promise<unknown>
  style?: (name: string) => Promise<unknown>
  tap: () => Promise<void>
  text?: () => Promise<unknown>
  value?: () => Promise<unknown>
  wxml?: () => Promise<unknown>
}

export function resolveDevtoolsProjectPath(workspaceRoot: string, projectPath: string) {
  return path.isAbsolute(projectPath)
    ? path.normalize(projectPath)
    : path.resolve(workspaceRoot, projectPath)
}

export function resolveDevtoolsWorkspacePath(workspaceRoot: string, filePath: string) {
  return path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(workspaceRoot, filePath)
}

export function toDevtoolsSerializableValue(value: unknown): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    }
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
    return value.map(item => toDevtoolsSerializableValue(item))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toDevtoolsSerializableValue(item)]))
  }
  return String(value)
}

async function callOptionalElementMethod(
  element: MiniProgramElementLike,
  methodName: string,
  fallback: unknown,
  ...args: unknown[]
) {
  const method = Reflect.get(element, methodName)
  if (typeof method !== 'function') {
    return fallback
  }

  try {
    return await method.apply(element, args)
  }
  catch {
    return fallback
  }
}

export async function readDevtoolsElementSnapshot(
  element: MiniProgramElementLike,
  selector: string,
  attributeNames: readonly string[] = [],
  styleNames: readonly string[] = [],
): Promise<DevtoolsElementSnapshot> {
  const [text, value, offset, size, wxml, outerWxml] = await Promise.all([
    callOptionalElementMethod(element, 'text', null),
    callOptionalElementMethod(element, 'value', undefined),
    callOptionalElementMethod(element, 'offset', null),
    callOptionalElementMethod(element, 'size', null),
    callOptionalElementMethod(element, 'wxml', null),
    callOptionalElementMethod(element, 'outerWxml', null),
  ])

  const attributes = Object.fromEntries(await Promise.all(attributeNames.map(async (name) => {
    return [name, await callOptionalElementMethod(element, 'attribute', null, name)]
  })))
  const styles = Object.fromEntries(await Promise.all(styleNames.map(async (name) => {
    return [name, await callOptionalElementMethod(element, 'style', null, name)]
  })))

  return {
    selector,
    tagName: element.tagName ?? '',
    text: typeof text === 'string' ? text : null,
    value: toDevtoolsSerializableValue(value),
    attributes,
    styles,
    offset: toDevtoolsSerializableValue(offset),
    size: toDevtoolsSerializableValue(size),
    wxml: typeof wxml === 'string' ? wxml : null,
    outerWxml: typeof outerWxml === 'string' ? outerWxml : null,
  }
}
