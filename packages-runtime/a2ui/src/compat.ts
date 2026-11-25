import { AbortControllerPolyfill, AbortSignalPolyfill } from '@wevu/web-apis/abort'

/**
 * 安装 A2UI Core 需要、但小程序 AppService 未必提供的内建。
 *
 * Core 0.15 起使用 `Object.hasOwn`，0.16 起在动作解析路径构造 `AbortController`；
 * 宿主已提供同名内建时保持原实现，重复调用无副作用。入口显式调用本函数而不是依赖
 * 裸副作用导入，避免打包阶段把兼容层当作无引用模块裁剪掉。
 */
export function installA2uiRuntimeCompat() {
  const host = globalThis as Record<string, any>
  if (typeof host.AbortController !== 'function') {
    host.AbortController = AbortControllerPolyfill
  }
  if (typeof host.AbortSignal !== 'function') {
    host.AbortSignal = AbortSignalPolyfill
  }
  if (typeof Object.hasOwn !== 'function') {
    Object.defineProperty(Object, 'hasOwn', {
      configurable: true,
      writable: true,
      value(object: unknown, key: PropertyKey) {
        if (object == null) {
          throw new TypeError('Object.hasOwn requires a non-null object')
        }
        return Object.prototype.hasOwnProperty.call(object, key)
      },
    })
  }
}
