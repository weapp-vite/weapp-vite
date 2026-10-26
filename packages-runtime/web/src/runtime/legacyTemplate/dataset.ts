import { WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX } from '@weapp-core/constants'
import { clearRuntimeDataset, storeRuntimeDataset } from '../dataset'

export type LegacyDatasetValues = Array<Map<string, unknown>>

interface LegacyDatasetCommit {
  values: LegacyDatasetValues
  bound: Array<{ element: Element, attributes: string[] }>
}

const commits = new WeakMap<object, LegacyDatasetCommit>()

/** 每次渲染只收集当前组件的值，提交前仍由旧一轮绑定负责读取。 */
export function resetLegacyDatasetRender(context: object) {
  const commit = commits.get(context)
  if (commit) {
    commit.values = []
  }
}

export function recordLegacyDatasetRender(context: object, values: LegacyDatasetValues) {
  const commit = commits.get(context) ?? { values, bound: [] }
  commit.values = values
  commits.set(context, commit)
}

export function createLegacyDatasetAnchor(values: LegacyDatasetValues, dataset: Map<string, unknown>) {
  const index = values.push(dataset) - 1
  return `<!--${WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX}${index}-->`
}

/** 释放本组件提交过的绑定；重复调用不影响其他组件或同一元素的其他属性。 */
export function releaseLegacyDatasetBindings(context: object) {
  const commit = commits.get(context)
  if (!commit) {
    return
  }
  for (const { element, attributes } of commit.bound) {
    for (const attribute of attributes) {
      clearRuntimeDataset(element, attribute)
    }
  }
  commit.bound = []
}

/** HTML 字符串相同也重新提交值，避免相同字符串化结果遮蔽新对象。 */
export function commitLegacyDatasetBindings(root: HTMLElement | ShadowRoot, context: object) {
  const commit = commits.get(context)
  if (!commit) {
    return
  }
  releaseLegacyDatasetBindings(context)
  if (commit.values.length === 0) {
    return
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  while (walker.nextNode()) {
    const comment = walker.currentNode as Comment
    if (!comment.data.startsWith(WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX)) {
      continue
    }
    const index = comment.data.slice(WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX.length)
    const values = /^\d+$/.test(index) ? commit.values[Number(index)] : undefined
    const element = comment.nextSibling
    if (!values || element?.nodeType !== Node.ELEMENT_NODE) {
      continue
    }
    for (const [attribute, value] of values) {
      storeRuntimeDataset(element as Element, attribute, value)
    }
    commit.bound.push({ element: element as Element, attributes: [...values.keys()] })
  }
}
