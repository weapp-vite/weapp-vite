/**
 * 路由元信息支持的有限静态 JSON 值。
 */
export type StaticRouteValue
  = | null
    | boolean
    | number
    | string
    | StaticRouteValue[]
    | { [key: string]: StaticRouteValue }

/**
 * `definePage` 在编译期提取的页面路由声明。
 */
export interface StaticPageDeclaration {
  name: string
  meta?: Record<string, StaticRouteValue>
}
