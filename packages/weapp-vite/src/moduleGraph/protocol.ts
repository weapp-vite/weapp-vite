import {
  WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX,
  WEAPP_VITE_LOGICAL_ENTRY_VIRTUAL_PREFIX,
  WEAPP_VITE_SIDECAR_OWNER_QUERY_MARKER,
  WEAPP_VITE_SIDECAR_QUERY_MARKER,
  WEAPP_VITE_SIDECAR_RESOLVED_PREFIX,
  WEAPP_VITE_SIDECAR_VIRTUAL_PREFIX,
} from '@weapp-core/constants'
import path from 'pathe'
import { resolveRealpath } from '../utils/realpathScope'

export type LogicalEntryType = 'app' | 'page' | 'component' | 'layout'

export type SidecarModuleKind
  = | 'json'
    | 'jsx'
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
  dependencyOnly?: true
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
    return path.normalize(resolveRealpath(normalized))
  }
  catch {
    return normalized
  }
}

function normalizeSidecarRequest(ownerId: string, sourceId: string, kind: SidecarModuleKind, dependencyOnly?: true): SidecarSourceRequest {
  const owner = normalizeProtocolPath(ownerId)
  return {
    kind,
    ownerId: owner,
    sourceId: sourceId === ownerId ? owner : normalizeProtocolPath(sourceId),
    ...(dependencyOnly ? { dependencyOnly } : {}),
  }
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

function serializeLogicalEntry(request: LogicalEntryRequest, prefix: string) {
  return `${prefix}${request.type}:${encodeURIComponent(request.sourceId)}${VIRTUAL_MODULE_SUFFIX}`
}

export function createLogicalEntryId(sourceId: string, type: LogicalEntryType) {
  return serializeLogicalEntry({ sourceId: normalizeProtocolPath(sourceId), type }, WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX)
}

export function createLogicalEntrySpecifier(sourceId: string, type: LogicalEntryType) {
  return serializeLogicalEntry({ sourceId: normalizeProtocolPath(sourceId), type }, WEAPP_VITE_LOGICAL_ENTRY_VIRTUAL_PREFIX)
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

function serializeSidecarModule(request: SidecarModuleRequest, prefix: string) {
  return `${prefix}${request.kind}:${encodeURIComponent(request.ownerId)}:${encodeURIComponent(request.sourceId)}${VIRTUAL_MODULE_SUFFIX}`
}

export function createSidecarModuleId(ownerId: string, sourceId: string, kind: SidecarModuleKind) {
  return serializeSidecarModule(normalizeSidecarRequest(ownerId, sourceId, kind), WEAPP_VITE_SIDECAR_RESOLVED_PREFIX)
}

export function createSidecarModuleSpecifier(ownerId: string, sourceId: string, kind: SidecarModuleKind) {
  return serializeSidecarModule(normalizeSidecarRequest(ownerId, sourceId, kind), WEAPP_VITE_SIDECAR_VIRTUAL_PREFIX)
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
    || !['json', 'jsx', 'layout', 'script', 'style', 'template', 'using-component', 'wxs'].includes(kind)
  ) {
    return
  }
  return normalizeSidecarRequest(decodeURIComponent(ownerId), decodeURIComponent(sourceId), kind as SidecarModuleKind)
}

export function createSidecarSourceSpecifier(ownerId: string, sourceId: string, kind: SidecarModuleKind, dependencyOnly = false) {
  const emitsStyle = kind === 'style' && !dependencyOnly
  const queryPrefix = emitsStyle ? '?' : '?raw&'
  const suffix = emitsStyle ? SIDECAR_SOURCE_STYLE_SUFFIX : SIDECAR_SOURCE_JS_SUFFIX
  const normalized = normalizeSidecarRequest(ownerId, sourceId, kind)
  return `${normalized.sourceId}${queryPrefix}${WEAPP_VITE_SIDECAR_OWNER_QUERY_MARKER}=${encodeURIComponent(normalized.ownerId)}&${WEAPP_VITE_SIDECAR_QUERY_MARKER}=${kind}${suffix}`
}

function readSidecarSourceRequest(id: string): SidecarSourceRequest | undefined {
  const queryIndex = id.indexOf('?')
  if (queryIndex < 0) {
    return
  }
  const query = new URLSearchParams(id.slice(queryIndex + 1))
  const kind = query.get(WEAPP_VITE_SIDECAR_QUERY_MARKER)
  const ownerId = query.get(WEAPP_VITE_SIDECAR_OWNER_QUERY_MARKER)
  if (!kind || !['json', 'jsx', 'layout', 'script', 'style', 'template', 'using-component', 'wxs'].includes(kind)) {
    return
  }
  if (!ownerId) {
    return
  }
  const isStyle = kind === 'style'
  const dependencyOnly = isStyle && query.has('raw')
  const emitsStyle = isStyle && !dependencyOnly
  const hasExpectedLang = query.has(emitsStyle ? 'lang.css' : 'lang.js')
  const hasUnexpectedLang = query.has(emitsStyle ? 'lang.js' : 'lang.css')
  const hasExpectedRawMode = query.has('raw') !== emitsStyle
  if (!hasExpectedLang || hasUnexpectedLang || !hasExpectedRawMode) {
    return
  }
  return {
    kind: kind as SidecarModuleKind,
    ownerId,
    sourceId: id.slice(0, queryIndex),
    ...(dependencyOnly ? { dependencyOnly: true as const } : {}),
  }
}

export function parseSidecarSourceRequest(id: string): SidecarSourceRequest | undefined {
  const request = readSidecarSourceRequest(id)
  if (request) {
    return normalizeSidecarRequest(request.ownerId, request.sourceId, request.kind, request.dependencyOnly)
  }
}

/** 仅校验协议及交付类型；需要文件身份的图操作仍使用完整路径解析。 */
export function parseSidecarSourceMetadata(id: string): Pick<SidecarSourceRequest, 'kind' | 'dependencyOnly'> | undefined {
  const request = readSidecarSourceRequest(id)
  if (request) {
    return { kind: request.kind, ...(request.dependencyOnly ? { dependencyOnly: true } : {}) }
  }
}

export function resolveVirtualModuleId(id: string) {
  const logicalEntry = parseLogicalEntryId(id)
  if (logicalEntry) {
    return serializeLogicalEntry(logicalEntry, WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX)
  }
  const sidecar = parseSidecarModuleId(id)
  if (sidecar) {
    return serializeSidecarModule(sidecar, WEAPP_VITE_SIDECAR_RESOLVED_PREFIX)
  }
}
