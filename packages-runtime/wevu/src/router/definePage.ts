import type { StaticPageDeclaration } from '@wevu/compiler'
import { WEVU_DEFINE_PAGE_MACRO } from '@weapp-core/constants'

/**
 * 声明页面的静态路由名称与元信息。
 *
 * 此调用必须由 weapp-vite 在编译阶段移除。
 */
export function definePage(_declaration: StaticPageDeclaration): void {
  throw new Error(`${WEVU_DEFINE_PAGE_MACRO}() is a compiler macro and must be compiled by weapp-vite.`)
}
