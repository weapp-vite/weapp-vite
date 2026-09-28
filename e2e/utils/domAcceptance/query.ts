import type { DomElement, DomProvider, DomQuery } from './types'

/** 通用组件是验收层语义；真实 IDE 只在节点元数据中暴露 component，不保证同名 CSS 标签可查询。 */
export async function queryDomElements<T extends DomElement>(
  query: (selector: string) => Promise<T[]>,
  selector: string,
  provider: DomProvider,
  mode: DomQuery,
): Promise<T[]> {
  const genericComponent = provider === 'devtools' && mode === 'css' && selector === 'component'
  const elements = await query(genericComponent ? '*' : selector)
  if (genericComponent && elements.some(element => typeof element.tagName !== 'string')) {
    throw new Error('DOM provider cannot identify rendered component hosts')
  }
  return genericComponent ? elements.filter(element => element.tagName === 'component') : elements
}
