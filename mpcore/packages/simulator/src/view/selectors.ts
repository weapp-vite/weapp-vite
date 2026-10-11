import type { Options } from 'css-select'
import type { Selector } from 'css-what'
import { selectAll } from 'css-select'
import { AttributeAction, parse, SelectorType } from 'css-what'
import { getInspectionChildren, getInspectionParent } from './inspectionTree'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

type SelectorAdapter = NonNullable<Options<DomNodeLike, DomNodeLike>['adapter']>

function createAdapter(getChildren: SelectorAdapter['getChildren'], getParent: SelectorAdapter['getParent']): SelectorAdapter {
  const adapter: SelectorAdapter = {
    isTag: (node): node is DomNodeLike => node.type === 'tag',
    getAttributeValue: (node, name) => node.attribs?.[name],
    getChildren,
    getName: node => node.name ?? '',
    getParent,
    getSiblings: (node) => {
      const parent = getParent(node)
      return parent ? getChildren(parent) : [node]
    },
    getText: node => node.type === 'text' ? node.data ?? '' : getChildren(node).map(child => adapter.getText(child)).join(''),
    hasAttrib: (node, name) => Object.hasOwn(node.attribs ?? {}, name),
    removeSubsets: (nodes) => {
      const unique = new Set(nodes)
      return [...unique].filter((node) => {
        for (let parent = getParent(node); parent; parent = getParent(parent)) {
          if (unique.has(parent)) {
            return false
          }
        }
        return true
      })
    },
  }
  return adapter
}

const renderedAdapter = createAdapter(node => node.children ?? [], node => node.parent ?? null)
const inspectionAdapter = createAdapter(getInspectionChildren, getInspectionParent)

function resolveComponentTags(selectors: Selector[][]): Selector[][] {
  return selectors.map(group => group.map((token): Selector => {
    if (token.type === SelectorType.Pseudo && Array.isArray(token.data)) {
      return { ...token, data: resolveComponentTags(token.data) }
    }
    if (token.type !== SelectorType.Tag || token.namespace !== null || token.name === 'page') {
      return token
    }
    const component: Selector = {
      type: SelectorType.Attribute,
      name: 'data-sim-component',
      action: token.name === 'component' ? AttributeAction.Exists : AttributeAction.Equals,
      value: token.name === 'component' ? '' : token.name,
      ignoreCase: false,
      namespace: null,
    }
    return token.name === 'component'
      ? component
      : { type: SelectorType.Pseudo, name: 'is', data: [[token], [component]] }
  }))
}

function queryWithAdapter(root: DomNodeLike, selector: string, adapter: SelectorAdapter): DomNodeLike[] {
  const parsed = parse(selector)
  const query = resolveComponentTags(parsed)
  // page 是自动化协议的可查询根节点，普通组件查询仍只搜索后代。
  const includesPageRoot = root.type === 'tag' && root.name === 'page'
    && parsed.some(group => group.some(token => token.type === SelectorType.Tag && token.name === 'page'))
  return selectAll(query, includesPageRoot ? [root] : root, { adapter, cacheResults: false })
}

export function querySelectorAll(root: DomNodeLike, selector: string): DomNodeLike[] {
  return queryWithAdapter(root, selector, renderedAdapter)
}

export function queryInspectionSelectorAll(root: DomNodeLike, selector: string): DomNodeLike[] {
  return queryWithAdapter(root, selector, inspectionAdapter)
}
