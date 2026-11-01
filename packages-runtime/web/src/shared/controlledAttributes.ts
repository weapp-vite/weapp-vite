const scrollViewAttributes = ['refresher-triggered'] as const

/** 这些属性需要区分显式数据提交与普通重新渲染。 */
export function resolveControlledNativeAttributes(tag: string): readonly string[] {
  return tag === 'scroll-view' ? scrollViewAttributes : []
}
