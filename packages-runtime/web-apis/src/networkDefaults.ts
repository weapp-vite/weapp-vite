import type {
  WeapiMiniProgramConnectSocketOption,
  WeapiMiniProgramRequestOption,
} from '@wevu/api'
import { WEVU_WEB_APIS_NETWORK_DEFAULTS_KEY } from '@weapp-core/constants'

const MINI_PROGRAM_REQUEST_OPTION_KEYS = [
  'enableCache',
  'enableChunked',
  'enableHttp2',
  'enableHttpDNS',
  'enableProfile',
  'enableQuic',
  'forceCellularNetwork',
  'httpDNSServiceId',
  'httpDNSTimeout',
  'redirect',
  'timeout',
  'useHighPerformanceMode',
] as const

const MINI_PROGRAM_SOCKET_OPTION_KEYS = [
  'forceCellularNetwork',
  'header',
  'perMessageDeflate',
  'timeout',
] as const

type RequestGlobalsMiniProgramOptionKey = typeof MINI_PROGRAM_REQUEST_OPTION_KEYS[number]
type WebSocketMiniProgramOptionKey = typeof MINI_PROGRAM_SOCKET_OPTION_KEYS[number]

export type RequestGlobalsMiniProgramOptions = Pick<
  Partial<WeapiMiniProgramRequestOption>,
  RequestGlobalsMiniProgramOptionKey
>

export type WebSocketMiniProgramOptions = Pick<
  Partial<WeapiMiniProgramConnectSocketOption>,
  WebSocketMiniProgramOptionKey
>

export interface MiniProgramNetworkDefaults {
  request?: RequestGlobalsMiniProgramOptions
  socket?: WebSocketMiniProgramOptions
}

type NetworkDefaultsHost = typeof globalThis & {
  [WEVU_WEB_APIS_NETWORK_DEFAULTS_KEY]?: MiniProgramNetworkDefaults
}

function getNetworkDefaultsHost() {
  return globalThis as NetworkDefaultsHost
}

function readMiniProgramNetworkDefaults() {
  return getNetworkDefaultsHost()[WEVU_WEB_APIS_NETWORK_DEFAULTS_KEY] ?? {}
}

function hasOwnProperty(source: object, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeOptions<TKey extends string>(
  keys: readonly TKey[],
  sources: unknown[],
): Partial<Record<TKey, unknown>> {
  const options: Partial<Record<TKey, unknown>> = {}

  for (const source of sources) {
    if (!isObject(source)) {
      continue
    }

    const candidate = source as Partial<Record<TKey, unknown>>
    for (const key of keys) {
      if (!hasOwnProperty(candidate, key)) {
        continue
      }
      const value = candidate[key]
      if (value !== undefined) {
        options[key] = value
      }
    }
  }

  return options
}

export function normalizeRequestMiniProgramOptions(...sources: unknown[]) {
  return normalizeOptions(MINI_PROGRAM_REQUEST_OPTION_KEYS, sources) as RequestGlobalsMiniProgramOptions
}

export function normalizeWebSocketMiniProgramOptions(...sources: unknown[]) {
  return normalizeOptions(MINI_PROGRAM_SOCKET_OPTION_KEYS, sources) as WebSocketMiniProgramOptions
}

export function getMiniProgramNetworkDefaults(): MiniProgramNetworkDefaults {
  const defaults = readMiniProgramNetworkDefaults()
  return {
    request: normalizeRequestMiniProgramOptions(defaults.request),
    socket: normalizeWebSocketMiniProgramOptions(defaults.socket),
  }
}

export function setMiniProgramNetworkDefaults(defaults: MiniProgramNetworkDefaults = {}) {
  getNetworkDefaultsHost()[WEVU_WEB_APIS_NETWORK_DEFAULTS_KEY] = {
    request: normalizeRequestMiniProgramOptions(defaults.request),
    socket: normalizeWebSocketMiniProgramOptions(defaults.socket),
  }
  return getMiniProgramNetworkDefaults()
}

export function resetMiniProgramNetworkDefaults() {
  delete getNetworkDefaultsHost()[WEVU_WEB_APIS_NETWORK_DEFAULTS_KEY]
  return getMiniProgramNetworkDefaults()
}

export function resolveRequestMiniProgramOptions(...sources: unknown[]) {
  const defaults = getMiniProgramNetworkDefaults()
  return normalizeRequestMiniProgramOptions(defaults.request, ...sources)
}

export function resolveWebSocketMiniProgramOptions(...sources: unknown[]) {
  const defaults = getMiniProgramNetworkDefaults()
  return normalizeWebSocketMiniProgramOptions(defaults.socket, ...sources)
}
