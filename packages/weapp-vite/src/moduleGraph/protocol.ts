import { realpathSync } from 'node:fs'
import {
  WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX,
  WEAPP_VITE_LOGICAL_ENTRY_VIRTUAL_PREFIX,
  WEAPP_VITE_SIDECAR_OWNER_QUERY_MARKER,
  WEAPP_VITE_SIDECAR_QUERY_MARKER,
  WEAPP_VITE_SIDECAR_RESOLVED_PREFIX,
  WEAPP_VITE_SIDECAR_VIRTUAL_PREFIX,
} from '@weapp-core/constants'
import path from 'pathe'

export type LogicalEntryType = 'app' | 'page' | 'component' | 'layout'

export type SidecarModuleKind
  = | 'json'
    | 'layout'
    | 'script'
    | 'style'
    | 'template'
    | 'using-component'
    | 'wxs'

export interface LogicalEntryRequest {
  sourceId: string
  type: LogicalEntryType
}

export interface SidecarModuleRequest {
  kind: SidecarModuleKind
  ownerId: string
  sourceId: string
}

export interface SidecarSourceRequest {
  kind: SidecarModuleKind
  ownerId: string
  sourceId: string
}

const VIRTUAL_MODULE_SUFFIX = ':module.js'
const SIDECAR_SOURCE_JS_SUFFIX = '&lang.js'
const SIDECAR_SOURCE_STYLE_SUFFIX = '&lang.css'

function normalizeProtocolPath(id: string) {
  const normalized = path.normalize(id.replaceAll('\\', '/'))
  if (!path.isAbsolute(normalized)) {
    return normalized
  }
  try {
    return path.normalize(realpathSync.native(normalized))
  }
  catch {
    return normalized
  }
}

function encodePath(id: string) {
  return encodeURIComponent(normalizeProtocolPath(id))
}

function decodePath(id: string) {
  return normalizeProtocolPath(decodeURIComponent(id))
}

function resolveProtocolPrefix(id: string, virtualPrefix: string, resolvedPrefix: string) {
  if (id.startsWith(resolvedPrefix)) {
    return id.slice(resolvedPrefix.length)
  }
  if (id.startsWith(virtualPrefix)) {
    return id.slice(virtualPrefix.length)
  }
}

export function createLogicalEntryId(sourceId: string, type: LogicalEntryType) {
  return `${WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX}${type}:${encodePath(sourceId)}${VIRTUAL_MODULE_SUFFIX}`
}

export function createLogicalEntrySpecifier(sourceId: string, type: LogicalEntryType) {
  return `${WEAPP_VITE_LOGICAL_ENTRY_VIRTUAL_PREFIX}${type}:${encodePath(sourceId)}${VIRTUAL_MODULE_SUFFIX}`
}

export function parseLogicalEntryId(id: string): LogicalEntryRequest | undefined {
  const request = resolveProtocolPrefix(
    id,
    WEAPP_VITE_LOGICAL_ENTRY_VIRTUAL_PREFIX,
    WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX,
  )
  if (!request) {
    return
  }
  if (!request.endsWith(VIRTUAL_MODULE_SUFFIX)) {
    return
  }
  const normalizedRequest = request.slice(0, -VIRTUAL_MODULE_SUFFIX.length)
  const separator = normalizedRequest.indexOf(':')
  if (separator < 0) {
    return
  }
  const type = normalizedRequest.slice(0, separator) as LogicalEntryType
  if (!['app', 'page', 'component', 'layout'].includes(type)) {
    return
  }
  return {
    sourceId: decodePath(normalizedRequest.slice(separator + 1)),
    type,
  }
}

export function createSidecarModuleId(ownerId: string, sourceId: string, kind: SidecarModuleKind) {
  return `${WEAPP_VITE_SIDECAR_RESOLVED_PREFIX}${kind}:${encodePath(ownerId)}:${encodePath(sourceId)}${VIRTUAL_MODULE_SUFFIX}`
}

export function createSidecarModuleSpecifier(ownerId: string, sourceId: string, kind: SidecarModuleKind) {
  return `${WEAPP_VITE_SIDECAR_VIRTUAL_PREFIX}${kind}:${encodePath(ownerId)}:${encodePath(sourceId)}${VIRTUAL_MODULE_SUFFIX}`
}

export function parseSidecarModuleId(id: string): SidecarModuleRequest | undefined {
  const request = resolveProtocolPrefix(
    id,
    WEAPP_VITE_SIDECAR_VIRTUAL_PREFIX,
    WEAPP_VITE_SIDECAR_RESOLVED_PREFIX,
  )
  if (!request) {
    return
  }
  if (!request.endsWith(VIRTUAL_MODULE_SUFFIX)) {
    return
  }
  const normalizedRequest = request.slice(0, -VIRTUAL_MODULE_SUFFIX.length)
  const [kind, ownerId, sourceId, ...rest] = normalizedRequest.split(':')
  if (
    rest.length
    || !kind
    || !ownerId
    || !sourceId
    || !['json', 'layout', 'script', 'style', 'template', 'using-component', 'wxs'].includes(kind)
  ) {
    return
  }
  return {
    kind: kind as SidecarModuleKind,
    ownerId: decodePath(ownerId),
    sourceId: decodePath(sourceId),
  }
}

export function createSidecarSourceSpecifier(ownerId: string, sourceId: string, kind: SidecarModuleKind) {
  const queryPrefix = kind === 'style' ? '?' : '?raw&'
  const suffix = kind === 'style' ? SIDECAR_SOURCE_STYLE_SUFFIX : SIDECAR_SOURCE_JS_SUFFIX
  return `${normalizeProtocolPath(sourceId)}${queryPrefix}${WEAPP_VITE_SIDECAR_OWNER_QUERY_MARKER}=${encodePath(ownerId)}&${WEAPP_VITE_SIDECAR_QUERY_MARKER}=${kind}${suffix}`
}

export function parseSidecarSourceRequest(id: string): SidecarSourceRequest | undefined {
  const queryIndex = id.indexOf('?')
  if (queryIndex < 0) {
    return
  }
  const query = new URLSearchParams(id.slice(queryIndex + 1))
  const kind = query.get(WEAPP_VITE_SIDECAR_QUERY_MARKER)
  const ownerId = query.get(WEAPP_VITE_SIDECAR_OWNER_QUERY_MARKER)
  if (!kind || !['json', 'layout', 'script', 'style', 'template', 'using-component', 'wxs'].includes(kind)) {
    return
  }
  if (!ownerId) {
    return
  }
  const isStyle = kind === 'style'
  const hasExpectedLang = query.has(isStyle ? 'lang.css' : 'lang.js')
  const hasUnexpectedLang = query.has(isStyle ? 'lang.js' : 'lang.css')
  const hasExpectedRawMode = query.has('raw') !== isStyle
  if (!hasExpectedLang || hasUnexpectedLang || !hasExpectedRawMode) {
    return
  }
  return {
    kind: kind as SidecarModuleKind,
    ownerId: normalizeProtocolPath(ownerId),
    sourceId: normalizeProtocolPath(id.slice(0, queryIndex)),
  }
}

export function resolveVirtualModuleId(id: string) {
  const logicalEntry = parseLogicalEntryId(id)
  if (logicalEntry) {
    return createLogicalEntryId(logicalEntry.sourceId, logicalEntry.type)
  }
  const sidecar = parseSidecarModuleId(id)
  if (sidecar) {
    return createSidecarModuleId(sidecar.ownerId, sidecar.sourceId, sidecar.kind)
  }
}
