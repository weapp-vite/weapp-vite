import type { Mock } from 'vitest'
import type {
  WeapiAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiInstance,
} from '../core/types'
import { beforeEach, vi } from 'vitest'
import {
  WEAPI_ALIPAY_METHODS,
  WEAPI_DOUYIN_METHODS,
  WEAPI_WECHAT_METHODS,
} from '../core/apiCatalog'

type Procedure = (...args: any[]) => any
type ApiMockKey = string | symbol
type MockImplementation<T extends Procedure> = (...args: Parameters<T>) => ReturnType<T>

type ApiMockFunction<
  TPublic extends Procedure,
  TRaw extends Procedure = TPublic,
> = Omit<Mock<TPublic>, 'mockImplementation' | 'mockImplementationOnce' | 'withImplementation'>
  & TPublic
  & {
    mockImplementation: {
      (implementation: MockImplementation<TRaw>): ApiMockFunction<TPublic, TRaw>
      (implementation: MockImplementation<TPublic>): ApiMockFunction<TPublic, TRaw>
    }
    mockImplementationOnce: {
      (implementation: MockImplementation<TRaw>): ApiMockFunction<TPublic, TRaw>
      (implementation: MockImplementation<TPublic>): ApiMockFunction<TPublic, TRaw>
    }
    withImplementation: {
      (implementation: MockImplementation<TRaw>, callback: () => Promise<unknown>): Promise<ApiMockFunction<TPublic, TRaw>>
      (implementation: MockImplementation<TRaw>, callback: () => unknown): ApiMockFunction<TPublic, TRaw>
      (implementation: MockImplementation<TPublic>, callback: () => Promise<unknown>): Promise<ApiMockFunction<TPublic, TRaw>>
      (implementation: MockImplementation<TPublic>, callback: () => unknown): ApiMockFunction<TPublic, TRaw>
    }
  }

type RawMethod<TAdapter extends WeapiAdapter, TKey extends PropertyKey, TFallback extends Procedure>
  = TKey extends keyof TAdapter
    ? TAdapter[TKey] extends Procedure
      ? TAdapter[TKey]
      : TFallback
    : TFallback

/**
 * @description 与 API 实例方法签名对齐的 Vitest mock 对象。
 */
export type ApiMock<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter> = {
  [TKey in keyof WeapiInstance<TAdapter>]: WeapiInstance<TAdapter>[TKey] extends Procedure
    ? ApiMockFunction<
      WeapiInstance<TAdapter>[TKey],
      RawMethod<TAdapter, TKey, WeapiInstance<TAdapter>[TKey]>
    >
    : WeapiInstance<TAdapter>[TKey]
}

/**
 * @description 创建 API mock 时预设的属性或方法实现。
 */
export type ApiMockOverrides<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter>
  = Partial<WeapiInstance<TAdapter>>

interface ApiMockState {
  mocks: Set<Mock>
  values: Map<ApiMockKey, unknown>
}

const INTERNAL_METHOD_NAMES = [
  'getAdapter',
  'resolveTarget',
  'setAdapter',
  'supports',
] as const

const API_METHOD_NAMES = new Set<ApiMockKey>([
  ...WEAPI_WECHAT_METHODS,
  ...WEAPI_ALIPAY_METHODS,
  ...WEAPI_DOUYIN_METHODS,
  ...INTERNAL_METHOD_NAMES,
])

const API_VALUE_NAMES = new Set<ApiMockKey>([
  'platform',
  'raw',
])

const API_MOCK_STATES = new WeakMap<object, ApiMockState>()

function createNamedMock(name: ApiMockKey, implementation?: Procedure) {
  const mock = implementation ? vi.fn(implementation) : vi.fn()
  return mock.mockName(`api.${String(name)}`)
}

function materializeOverride(state: ApiMockState, key: ApiMockKey, value: unknown) {
  if (typeof value === 'function') {
    const mock = vi.isMockFunction(value)
      ? value as Mock
      : createNamedMock(key, value as Procedure)
    state.mocks.add(mock)
    state.values.set(key, mock)
    return
  }
  state.values.set(key, value)
}

/**
 * @description 创建与 API 类型对齐、按访问惰性生成方法的 Vitest mock。
 */
export function createApiMock<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter>(
  overrides: ApiMockOverrides<NoInfer<TAdapter>> = {},
): ApiMock<TAdapter> {
  const state: ApiMockState = {
    mocks: new Set(),
    values: new Map(),
  }

  for (const key of Reflect.ownKeys(overrides)) {
    materializeOverride(state, key, Reflect.get(overrides, key))
  }

  const proxy = new Proxy(Object.create(null) as object, {
    get(_target, key) {
      if (key === Symbol.toStringTag) {
        return 'ApiMock'
      }
      if (key === 'then') {
        return undefined
      }
      if (state.values.has(key)) {
        return state.values.get(key)
      }
      if (API_VALUE_NAMES.has(key) || (typeof key !== 'string' && !API_METHOD_NAMES.has(key))) {
        return undefined
      }
      const mock = createNamedMock(key)
      state.mocks.add(mock)
      state.values.set(key, mock)
      return mock
    },
    getOwnPropertyDescriptor(_target, key) {
      if (!state.values.has(key)) {
        return undefined
      }
      return {
        configurable: true,
        enumerable: true,
        value: state.values.get(key),
        writable: true,
      }
    },
    has(_target, key) {
      return state.values.has(key) || API_METHOD_NAMES.has(key)
    },
    ownKeys() {
      return [...state.values.keys()]
    },
    set(_target, key, value) {
      materializeOverride(state, key, value)
      return true
    },
  }) as ApiMock<TAdapter>

  API_MOCK_STATES.set(proxy, state)
  return proxy
}

/**
 * @description 默认 API Vitest mock 单例。
 */
export const apiMock = createApiMock()

/**
 * @description 默认 API Vitest mock 单例的兼容名称。
 */
export const wpiMock = apiMock

/**
 * @description 创建 API Vitest mock 的兼容名称。
 */
export const createWpiMock = createApiMock

/**
 * @description 重置指定 API mock 自身已创建的方法，不影响其他 Vitest mocks。
 */
export function resetApiMock(mock: ApiMock<any> = apiMock): void {
  const state = API_MOCK_STATES.get(mock)
  state?.mocks.forEach(item => item.mockReset())
}

/**
 * @description 在 Vitest setup 文件中注册需要替换 API 实例的模块入口。
 */
export function setupApiMock(moduleIds: readonly string[]): void {
  for (const moduleId of moduleIds) {
    vi.doMock(moduleId, async () => {
      const actual = await vi.importActual<Record<string, unknown>>(moduleId)
      return {
        ...actual,
        api: apiMock,
        wpi: apiMock,
      }
    })
  }

  beforeEach(() => {
    resetApiMock(apiMock)
  })
}
