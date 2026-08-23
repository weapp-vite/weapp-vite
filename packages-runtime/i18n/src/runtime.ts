import type {
  I18nBehavior,
  I18nCatalog,
  I18nGlobal,
  I18nHost,
  I18nInstance,
  I18nLocaleChangeSubscription,
  I18nMessageToken,
  I18nOptions,
} from './types'
import { WEAPP_I18N_LOCALE_DATA_KEY } from '@weapp-core/constants'
import { compileI18nMessages } from './compiler'

interface RuntimeInstance {
  setData: (data: Record<string, unknown>) => void
}

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

function normalizeOptions(options: I18nOptions | I18nCatalog): I18nCatalog {
  if ('defaultLocale' in options && 'locales' in options) {
    validateCatalog(options)
    return options
  }

  const locale = options.locale.trim()
  const fallbackLocale = options.fallbackLocale?.trim() || locale
  if (!locale) {
    throw new Error('i18n locale 不能为空。')
  }
  const messages = compileI18nMessages(options.messages)
  const locales = Object.keys(messages).sort()
  const catalog = { defaultLocale: locale, fallbackLocale, locales, messages }
  validateCatalog(catalog)
  return catalog
}

function resolveHost(host?: Partial<I18nHost>): I18nHost {
  const behavior = host?.Behavior ?? (typeof Behavior === 'function' ? Behavior : undefined)
  const page = host?.Page ?? (typeof Page === 'function' ? Page : undefined)
  if (!behavior || !page) {
    throw new Error('i18n 运行时需要小程序 Behavior 和 Page 全局 API。')
  }
  return { Behavior: behavior, Page: page }
}

function createState(catalog: I18nCatalog) {
  let currentLocale = catalog.defaultLocale
  const instances = new Set<RuntimeInstance>()
  const listeners = new Set<(locale: string) => void>()

  function setLocale(locale: string) {
    if (!catalog.locales.includes(locale)) {
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
  }

  const global: I18nGlobal = {
    t(key, params = {}) {
      const current = catalog.messages[currentLocale] ?? {}
      const fallback = catalog.messages[catalog.fallbackLocale] ?? {}
      const tokens = hasOwn(current, key)
        ? current[key]
        : hasOwn(fallback, key) ? fallback[key] : undefined
      return tokens ? render(tokens, params) : key
    },
    get locale() {
      return currentLocale
    },
    set locale(locale: string) {
      setLocale(locale)
    },
    fallbackLocale: catalog.fallbackLocale,
    availableLocales: Object.freeze([...catalog.locales]),
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

  return {
    currentLocale: () => currentLocale,
    global,
    attach(instance: RuntimeInstance) {
      instances.add(instance)
      instance.setData({ [WEAPP_I18N_LOCALE_DATA_KEY]: currentLocale })
    },
    detach(instance: RuntimeInstance) {
      instances.delete(instance)
    },
  }
}

function createBehavior(state: ReturnType<typeof createState>, host: I18nHost): I18nBehavior {
  return host.Behavior({
    data: {
      [WEAPP_I18N_LOCALE_DATA_KEY]: state.currentLocale(),
    },
    lifetimes: {
      attached() {
        state.attach(this as RuntimeInstance)
      },
      detached() {
        state.detach(this as RuntimeInstance)
      },
    },
  }) as unknown as I18nBehavior
}

function createPageAdapter(state: ReturnType<typeof createState>, host: I18nHost) {
  return ((options: WechatMiniprogram.Page.Options<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>) => {
    if (hasOwn(options.data, WEAPP_I18N_LOCALE_DATA_KEY)) {
      throw new Error(`i18n Page data 与保留字段 \`${WEAPP_I18N_LOCALE_DATA_KEY}\` 冲突。`)
    }

    const originalLoad = options.onLoad
    const originalUnload = options.onUnload
    const next = Object.assign({}, options, {
      data: Object.assign({}, options.data, {
        [WEAPP_I18N_LOCALE_DATA_KEY]: state.currentLocale(),
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

export function createI18n(options: I18nOptions | I18nCatalog, host?: Partial<I18nHost>): I18nInstance {
  const resolvedHost = resolveHost(host)
  const state = createState(normalizeOptions(options))
  return {
    global: state.global,
    behavior: createBehavior(state, resolvedHost),
    page: createPageAdapter(state, resolvedHost),
  }
}

export type {
  I18nBehavior,
  I18nCatalog,
  I18nGlobal,
  I18nHost,
  I18nInstance,
  I18nLocaleChangeSubscription,
  I18nOptions,
} from './types'
