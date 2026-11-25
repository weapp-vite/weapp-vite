import type { ComponentApi, FunctionImplementation } from '@a2ui/web_core'
import { Catalog } from '@a2ui/web_core'

/** 当前实现只接受 v1.0 消息与目录。 */
export const A2UI_PROTOCOL_VERSION = '1.0' as const

export interface A2uiCatalog {
  readonly id: string
  readonly catalog: Catalog<ComponentApi, FunctionImplementation>
}

/**
 * 从消费方的 catalog 文档构建可执行目录。
 *
 * Core 的 `fromJson` 产物是 schema-only 目录，`NodeResolver` 需要可执行函数目录，
 * 因此重建一个空函数目录，同时保留文档声明的 `$defs` 供 `$ref` 解析。
 */
export function createA2uiCatalog(document: Record<string, any>): A2uiCatalog {
  const schemaCatalog = Catalog.fromJson(document)
  const protocolVersion = String(schemaCatalog.protocolVersion)
  if (protocolVersion !== '1.0' && protocolVersion !== 'v1.0') {
    throw new TypeError(`@wevu/a2ui 仅支持 A2UI 1.0 catalog，收到 ${protocolVersion}。`)
  }
  const catalog = new Catalog(
    schemaCatalog.id,
    A2UI_PROTOCOL_VERSION,
    [...schemaCatalog.components.values()],
    [],
    { defs: schemaCatalog.defs },
  )
  return { id: schemaCatalog.id, catalog }
}
