import type {
  I18nBehavior,
  I18nBehaviorMethods,
  I18nCatalog,
  I18nHost,
  I18nInstance,
  I18nLocaleChangeSubscription,
  I18nMessageToken,
} from './types'
import { WEAPP_I18N_LOCALE_DATA_KEY } from '@weapp-core/constants'

interface RuntimeInstance {
  setData: (data: Record<string, unknown>) => void
}

const I18N_METHOD_NAMES = [
  't',
  'getLocale',
  'setLocale',
  'getFallbackLocale',
  'onLocaleChange',
] as const

function hasOwn(object: unknown, key: PropertyKey) {
  return object != null && Object.prototype.hasOwnProperty.call(object, key)
}

function resolveParam(params: Record<string, unknown>, key: string) {
  let current: unknown = params
  for (const part of key.split('.')) {
    if (!hasOwn(current, part)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function render(tokens: I18nMessageToken[], params: Record<string, unknown>) {
  let result = ''
  for (const token of tokens) {
    if (typeof token === 'string') {
      result += token
    }
    else {
      const value = resolveParam(params, token.key)
      result += value === undefined ? token.source : String(value)
    }
  }
  return result
}

function validateCatalog(catalog: I18nCatalog) {
  if (!catalog || !Array.isArray(catalog.locales) || !catalog.locales.length) {
    throw new TypeError('i18n catalog 必须包含至少一个 locale。')
  }
  if (!catalog.locales.includes(catalog.defaultLocale)) {
    throw new RangeError(`i18n defaultLocale 未构建：${catalog.defaultLocale}`)
  }
  if (!catalog.locales.includes(catalog.fallbackLocale)) {
    throw new RangeError(`i18n fallbackLocale 未构建：${catalog.fallbackLocale}`)
  }
}

function resolveHost(host?: Partial<I18nHost>, allowFallback = false): I18nHost {
  const behavior = host?.Behavior ?? (typeof Behavior === 'function' ? Behavior : undefined)
  const page = host?.Page ?? (typeof Page === 'function' ? Page : undefined)
  if (!behavior || !page) {
    if (allowFallback) {
      return {
        Behavior: ((options: unknown) => options) as unknown as I18nHost['Behavior'],
        Page: ((options: unknown) => options) as unknown as I18nHost['Page'],
      }
    }
    throw new Error('i18n 运行时需要小程序 Behavior 和 Page 全局 API。')
  }
  return { Behavior: behavior, Page: page }
}

function createI18nState(initialCatalog?: I18nCatalog) {
  let catalog: I18nCatalog | undefined
  let currentLocale = ''
  const instances = new Set<RuntimeInstance>()
  const listeners = new Set<(locale: string) => void>()

  function initialize(nextCatalog: I18nCatalog) {
    validateCatalog(nextCatalog)
    catalog = nextCatalog
    currentLocale = nextCatalog.defaultLocale
    for (const instance of instances) {
      instance.setData({ [WEAPP_I18N_LOCALE_DATA_KEY]: currentLocale })
    }
  }

  function requireCatalog() {
    if (!catalog) {
      throw new Error('i18n 尚未初始化，请先调用 initI18n()。')
    }
    return catalog
  }

  const methods: I18nBehaviorMethods = {
    t(key, params = {}) {
      const activeCatalog = requireCatalog()
      const current = activeCatalog.messages[currentLocale] ?? {}
      const fallback = activeCatalog.messages[activeCatalog.fallbackLocale] ?? {}
      const tokens = hasOwn(current, key)
        ? current[key]
        : hasOwn(fallback, key) ? fallback[key] : undefined
      return tokens ? render(tokens, params) : key
    },
    getLocale() {
      requireCatalog()
      return currentLocale
    },
    setLocale(locale) {
      const activeCatalog = requireCatalog()
      if (!activeCatalog.locales.includes(locale)) {
        throw new RangeError(`Unknown i18n locale: ${locale}`)
      }
      if (locale === currentLocale) {
        return
      }
      currentLocale = locale
      for (const instance of instances) {
        instance.setData({ [WEAPP_I18N_LOCALE_DATA_KEY]: locale })
      }
      for (const listener of listeners) {
        listener(locale)
      }
    },
    getFallbackLocale() {
      return requireCatalog().fallbackLocale
    },
    onLocaleChange(handler): I18nLocaleChangeSubscription {
      listeners.add(handler)
      let active = true
      return {
        off() {
          if (active) {
            active = false
            listeners.delete(handler)
          }
        },
      }
    },
  }

  function attach(instance: RuntimeInstance) {
    requireCatalog()
    instances.add(instance)
    instance.setData({ [WEAPP_I18N_LOCALE_DATA_KEY]: currentLocale })
  }

  function detach(instance: RuntimeInstance) {
    instances.delete(instance)
  }

  if (initialCatalog) {
    initialize(initialCatalog)
  }

  return {
    attach,
    detach,
    initialize,
    methods,
    initialLocale() {
      return catalog?.defaultLocale ?? ''
    },
    requireCatalog,
  }
}

function createBehavior(
  state: ReturnType<typeof createI18nState>,
  host: I18nHost,
): I18nBehavior {
  return host.Behavior({
    data: {
      [WEAPP_I18N_LOCALE_DATA_KEY]: state.initialLocale(),
    },
    lifetimes: {
      attached() {
        state.attach(this as RuntimeInstance)
      },
      detached() {
        state.detach(this as RuntimeInstance)
      },
    },
    methods: state.methods as unknown as WechatMiniprogram.Component.MethodOption,
  }) as unknown as I18nBehavior
}

function createPageAdapter(
  state: ReturnType<typeof createI18nState>,
  host: I18nHost,
) {
  return ((options: WechatMiniprogram.Page.Options<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>) => {
    if (hasOwn(options.data, WEAPP_I18N_LOCALE_DATA_KEY)) {
      throw new Error(`i18n Page data 与保留字段 \`${WEAPP_I18N_LOCALE_DATA_KEY}\` 冲突。`)
    }
    for (const methodName of I18N_METHOD_NAMES) {
      if (hasOwn(options, methodName)) {
        throw new Error(`i18n Page 方法与保留字段 \`${methodName}\` 冲突。`)
      }
    }

    const originalLoad = options.onLoad
    const originalUnload = options.onUnload
    const next = Object.assign({}, options, state.methods, {
      data: Object.assign({}, options.data, {
        [WEAPP_I18N_LOCALE_DATA_KEY]: state.requireCatalog().defaultLocale,
      }),
      onLoad(this: RuntimeInstance, ...args: unknown[]) {
        state.attach(this)
        try {
          return originalLoad?.apply(this, args as never)
        }
        catch (error) {
          state.detach(this)
          throw error
        }
      },
      onUnload(this: RuntimeInstance, ...args: unknown[]) {
        try {
          return originalUnload?.apply(this, args as never)
        }
        finally {
          state.detach(this)
        }
      },
    })
    return host.Page(next as never)
  }) as typeof Page
}

function createInstance(
  state: ReturnType<typeof createI18nState>,
  host: I18nHost,
): I18nInstance {
  const behavior = createBehavior(state, host)
  const definePage = createPageAdapter(state, host)
  return {
    ...state.methods,
    I18n: behavior,
    I18nPage: definePage,
    behavior,
    definePage,
  }
}

export function createI18n(catalog: I18nCatalog, host?: Partial<I18nHost>): I18nInstance {
  return createInstance(createI18nState(catalog), resolveHost(host))
}

export function createUninitializedI18n(host?: Partial<I18nHost>) {
  const resolvedHost = resolveHost(host, true)
  const state = createI18nState()
  const instance = createInstance(state, resolvedHost)
  let initialized = false
  return {
    init(catalog: I18nCatalog) {
      state.initialize(catalog)
      initialized = true
      return instance
    },
    get() {
      return initialized ? instance : undefined
    },
    instance,
  }
}

export type {
  I18nBehavior,
  I18nBehaviorMethods,
  I18nCatalog,
  I18nHost,
  I18nInstance,
  I18nLocaleChangeSubscription,
} from './types'
