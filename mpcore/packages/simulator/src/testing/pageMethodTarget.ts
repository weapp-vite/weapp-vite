/** 对齐 Page 协议的栈顶约束；AppService 模式仅访问 handle 对应且仍存活的页面。 */
export function resolveTestingPageMethodTarget<T>(
  page: T,
  pages: readonly T[] | undefined,
  options: { fallback?: boolean, routeOnly?: boolean },
): T | undefined {
  if (!pages) {
    return page
  }
  if (!options.routeOnly && options.fallback === false && pages.at(-1) !== page) {
    throw new Error('page is not on top of page stack')
  }
  return pages.includes(page) ? page : undefined
}
