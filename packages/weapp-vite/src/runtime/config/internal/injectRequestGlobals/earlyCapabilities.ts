import {
  REQUEST_GLOBAL_ACTUALS_KEY,
  REQUEST_GLOBAL_MARK_PLACEHOLDER_HELPER,
  REQUEST_GLOBAL_PLACEHOLDER_KEY,
} from '@weapp-core/constants'

/**
 * @description 模块初始化期就会被构造的能力型 global。
 * @description ky 等库会在顶层用 `new Request(...)` / `new ReadableStream()` 完成能力探测并缓存结果。
 */
export const EARLY_CAPABILITY_REQUEST_GLOBAL_TARGETS = ['Request', 'ReadableStream', 'AbortController'] as const

export type EarlyCapabilityRequestGlobalTarget = (typeof EARLY_CAPABILITY_REQUEST_GLOBAL_TARGETS)[number]

export const REQUEST_GLOBAL_EARLY_CAPABILITY_HELPER = '__wvECH'
export const REQUEST_GLOBAL_EARLY_CAPABILITY_FALLBACKS = '__wvECF'

const FALLBACK_SOURCE = `(() => {
  const noop = () => {}
  const emptyHeaders = () => ({
    has: () => false,
    get: () => null,
    set: noop,
    append: noop,
    delete: noop,
    forEach: noop,
  })
  return {
    Request(args) {
      const init = args[1] || {}
      // 与 RequestPolyfill 保持一致：不读取 duplex，避免误报请求流能力。
      return {
        url: String(args[0] ?? ''),
        method: String(init.method ?? 'GET').toUpperCase(),
        headers: emptyHeaders(),
        body: init.body ?? null,
        signal: init.signal ?? null,
      }
    },
    ReadableStream() {
      const stream = {
        locked: false,
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: undefined }),
          releaseLock: noop,
          cancel: () => Promise.resolve(),
        }),
        tee: () => [stream, stream],
        cancel: () => Promise.resolve(),
        pipeThrough: value => value,
        pipeTo: () => Promise.resolve(),
      }
      return stream
    },
    AbortController() {
      const signal = {
        aborted: false,
        reason: undefined,
        onabort: null,
        addEventListener: noop,
        removeEventListener: noop,
        dispatchEvent: () => true,
        throwIfAborted: noop,
      }
      return {
        signal,
        abort(reason) {
          signal.aborted = true
          signal.reason = reason
        },
      }
    },
  }
})()`

/**
 * @description 生成"早期能力探测兜底 + installer 后转发真实实现"的 helper 源码。
 * @description Request / ReadableStream / AbortController 与 fetch、Response、Headers 属于同一对象图，
 * @description 不能在 chunk 顶部内联一份独立实现，否则会与 installer 安装后的真实类不一致。
 * @description 因此 installer 之前只提供可构造且不抛错的最小对象，让依赖的顶层能力探测正常完成；
 * @description installer 写入 actuals 后，同一个绑定会通过 Reflect.construct 转发到真实实现。
 * @description 兜底构造器带 placeholder 标记，installWebRuntimeGlobals 会用它替换 globalThis 上的值。
 */
export function createEarlyCapabilityHelperCode() {
  return [
    `const ${REQUEST_GLOBAL_EARLY_CAPABILITY_FALLBACKS} = ${FALLBACK_SOURCE}`,
    `function ${REQUEST_GLOBAL_EARLY_CAPABILITY_HELPER}(name,makeFallback){let placeholder;const getActual=()=>{const actual=${REQUEST_GLOBAL_ACTUALS_KEY}[name];return typeof actual==="function"&&actual!==placeholder&&actual?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]!==true?actual:undefined};const target=function(...args){return makeFallback(args)};placeholder=new Proxy(target,{apply(target,thisArg,args){const actual=getActual();return actual?Reflect.apply(actual,thisArg,args):makeFallback(args)},construct(target,args,newTarget){const actual=getActual();return actual?Reflect.construct(actual,args,newTarget===placeholder?actual:newTarget):makeFallback(args)},get(target,key,receiver){if(key==="prototype"){const actual=getActual();if(actual?.prototype)return actual.prototype}return Reflect.get(target,key,receiver)}});return ${REQUEST_GLOBAL_MARK_PLACEHOLDER_HELPER}(placeholder)}`,
  ].join(';')
}
