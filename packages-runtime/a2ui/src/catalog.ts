import type { ComponentApi, FunctionApi } from '@a2ui/web_core/catalog'
import type { A2uiFunctionHandler, A2uiLocale } from './types'
import { Catalog, createFunctionImplementation } from '@a2ui/web_core/catalog'
import { installA2uiRuntimeCompat } from './compat'
import { createBuiltinFunctions } from './standardFunctions'
import { isStandardFunctionCompatible } from './standardFunctionSignatures'

/** 当前实现只接受 A2UI 1.0 消息与目录。 */
export const A2UI_PROTOCOL_VERSION = '1.0' as const

export interface A2uiCatalog {
  readonly id: string
  readonly catalog: Catalog<ComponentApi, FunctionApi>
}

export interface A2uiCatalogOptions {
  readonly locale?: A2uiLocale
}

/** 从消费方的 catalog 文档构建目录，并绑定宿主与兼容的标准函数。 */
export function createA2uiCatalog(
  document: Record<string, any>,
  functionImplementations: Readonly<Record<string, A2uiFunctionHandler>> = {},
  options: A2uiCatalogOptions = {},
): A2uiCatalog {
  installA2uiRuntimeCompat()
  const schemaCatalog = Catalog.fromJson(document)
  const builtinFunctions = createBuiltinFunctions(options.locale)
  const protocolVersion = String(schemaCatalog.protocolVersion)
  if (protocolVersion !== A2UI_PROTOCOL_VERSION) {
    throw new TypeError(`@wevu/a2ui 仅支持 A2UI 1.0 catalog，收到 ${protocolVersion}。`)
  }
  for (const name of Object.keys(functionImplementations)) {
    if (!schemaCatalog.functions.has(name)) {
      throw new TypeError(`catalog '${schemaCatalog.id}' 未声明函数 '${name}'。`)
    }
  }
  const functions: FunctionApi[] = [...schemaCatalog.functions.values()].map((api) => {
    const hostImplementation = Object.hasOwn(functionImplementations, api.name)
      ? functionImplementations[api.name]
      : undefined
    if (hostImplementation) {
      return createFunctionImplementation(api, args => hostImplementation(args))
    }
    const builtinImplementation = builtinFunctions.get(api.name)
    if (builtinImplementation && isStandardFunctionCompatible(api, builtinImplementation.returnType)) {
      return createFunctionImplementation(api, builtinImplementation.execute)
    }
    return api
  })
  const catalog = schemaCatalog.copyWith({ functions })
  return { id: schemaCatalog.id, catalog }
}
