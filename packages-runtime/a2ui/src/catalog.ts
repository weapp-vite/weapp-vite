import type { ComponentApi, FunctionImplementation } from '@a2ui/web_core/catalog'
import type { A2uiFunctionHandler } from './types'
import { Catalog, createFunctionImplementation } from '@a2ui/web_core/catalog'
import { A2uiExpressionError } from '@a2ui/web_core/errors'
import { installA2uiRuntimeCompat } from './compat'
import { builtinFunctions } from './standardFunctions'

/** 当前实现只接受 v1.0 消息与目录。 */
export const A2UI_PROTOCOL_VERSION = '1.0' as const

export interface A2uiCatalog {
  readonly id: string
  readonly catalog: Catalog<ComponentApi, FunctionImplementation>
}

/**
 * 从消费方的 catalog 文档构建可执行目录。
 *
 * Core 的 `fromJson` 产物是 schema-only 目录，`NodeResolver` 需要可执行函数目录。
 * 保留函数签名供消息校验；宿主实现优先，其次启用返回类型兼容的内置标准函数。
 */
export function createA2uiCatalog(
  document: Record<string, any>,
  functionImplementations: Readonly<Record<string, A2uiFunctionHandler>> = {},
): A2uiCatalog {
  installA2uiRuntimeCompat()
  const schemaCatalog = Catalog.fromJson(document)
  const protocolVersion = String(schemaCatalog.protocolVersion)
  if (protocolVersion !== '1.0' && protocolVersion !== 'v1.0') {
    throw new TypeError(`@wevu/a2ui 仅支持 A2UI 1.0 catalog，收到 ${protocolVersion}。`)
  }
  for (const name of Object.keys(functionImplementations)) {
    if (!schemaCatalog.functions.has(name)) {
      throw new TypeError(`catalog '${schemaCatalog.id}' 未声明函数 '${name}'。`)
    }
  }
  const functions = [...schemaCatalog.functions.values()].map((api) => {
    const hostImplementation = Object.hasOwn(functionImplementations, api.name)
      ? functionImplementations[api.name]
      : undefined
    const builtinImplementation = builtinFunctions.get(api.name)
    const compatibleBuiltin = builtinImplementation?.returnType === api.returnType
      ? builtinImplementation
      : undefined
    return createFunctionImplementation(api, (args, context, abortSignal) => {
      if (hostImplementation) {
        return hostImplementation(args)
      }
      if (compatibleBuiltin) {
        return compatibleBuiltin.execute(args, context, abortSignal)
      }
      throw new A2uiExpressionError(`@wevu/a2ui 未实现 catalog 函数 '${api.name}'。`, api.name)
    })
  })
  const catalog = new Catalog(
    schemaCatalog.id,
    A2UI_PROTOCOL_VERSION,
    [...schemaCatalog.components.values()],
    functions,
    { defs: schemaCatalog.defs },
  )
  return { id: schemaCatalog.id, catalog }
}
