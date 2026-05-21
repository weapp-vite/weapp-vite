import type { MiniProgramElement, MiniProgramLike, MiniProgramPage } from '../cli/automator-session'
import { Buffer } from 'node:buffer'
import path from 'node:path'

export interface DevtoolsConnectionInput {
  projectPath: string
  timeout?: number
  preferOpenedSession?: boolean
}

export interface DevtoolsToolResult<T> {
  result: T
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
  miniProgram: MiniProgramLike
  page: MiniProgramPage
}

export function resolveProjectPath(workspaceRoot: string, projectPath: string) {
  return path.isAbsolute(projectPath)
    ? path.normalize(projectPath)
    : path.resolve(workspaceRoot, projectPath)
}

export function toSerializableValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    }
  }

  if (Array.isArray(value)) {
    return value.map(item => toSerializableValue(item))
  }

  if (value && typeof value === 'object') {
    if (value instanceof Buffer) {
      return {
        byteLength: value.byteLength,
        type: 'Buffer',
      }
    }

    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toSerializableValue(entry)
    }
    return result
  }

  return value
}

export async function readElementSnapshot(
  element: MiniProgramElement,
  selector: string,
  attributeNames: readonly string[] = [],
  styleNames: readonly string[] = [],
): Promise<DevtoolsElementSnapshot> {
  const [text, value, offset, size, wxml, outerWxml] = await Promise.all([
    element.text().catch(() => null),
    element.value?.().catch(() => undefined),
    element.offset().catch(() => null),
    element.size().catch(() => null),
    element.wxml().catch(() => null),
    element.outerWxml().catch(() => null),
  ])

  const attributes = Object.fromEntries(await Promise.all(attributeNames.map(async (name) => {
    return [name, await element.attribute(name).catch(() => null)]
  })))
  const styles = Object.fromEntries(await Promise.all(styleNames.map(async (name) => {
    return [name, await element.style(name).catch(() => null)]
  })))

  return {
    selector,
    tagName: Reflect.get(element, 'tagName') ?? '',
    text: text as string | null,
    value: toSerializableValue(value),
    attributes,
    styles,
    offset: toSerializableValue(offset),
    size: toSerializableValue(size),
    wxml: wxml as string | null,
    outerWxml: outerWxml as string | null,
  }
}
