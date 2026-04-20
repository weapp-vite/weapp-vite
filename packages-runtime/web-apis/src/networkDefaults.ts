import type {
  WeapiMiniProgramConnectSocketOption,
  WeapiMiniProgramRequestOption,
} from '@wevu/api'

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

let miniProgramNetworkDefaults: MiniProgramNetworkDefaults = {}

function hasOwnProperty(source: object, key: string) {
  return Object.hasOwn(source, key)
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
  return {
    request: normalizeRequestMiniProgramOptions(miniProgramNetworkDefaults.request),
    socket: normalizeWebSocketMiniProgramOptions(miniProgramNetworkDefaults.socket),
  }
}

export function setMiniProgramNetworkDefaults(defaults: MiniProgramNetworkDefaults = {}) {
  miniProgramNetworkDefaults = {
    request: normalizeRequestMiniProgramOptions(defaults.request),
    socket: normalizeWebSocketMiniProgramOptions(defaults.socket),
  }
  return getMiniProgramNetworkDefaults()
}

export function resetMiniProgramNetworkDefaults() {
  miniProgramNetworkDefaults = {}
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
