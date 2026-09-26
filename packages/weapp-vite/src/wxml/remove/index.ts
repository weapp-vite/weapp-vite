import type { WxmlRemoveOptions } from '../../types'
import type { SourceRange, WxmlSyntax } from '../template/lexical'
import type { NameMatcher } from './matcher'
import { failAt } from '../template/lexical'
import { applySourceEdits } from '../template/ranges'
import { scanTemplate } from '../template/scan'
import { compileNames, matches } from './matcher'
import { assertSafeConditionalRemoval, isInstructionComment, isProtectedAttribute, scriptTags, structuralTags } from './safety'

/** 编译一次清理规则，在最终产物上仅删除匹配的源码区间。 */
export function createWxmlRemover(options: WxmlRemoveOptions): (code: string, fileName: string, syntax?: WxmlSyntax) => string {
  if (!options.attr?.length && !options.tag?.length && !options.comment) {
    return code => code
  }
  const globalNames: string[] = []
  const attributes: Array<{ tags?: NameMatcher, names: NameMatcher }> = []
  for (const rule of options.attr ?? []) {
    if (typeof rule === 'string') {
      globalNames.push(rule)
      continue
    }
    const tags = compileNames(rule.tag)
    const names = compileNames(rule.name)
    if ((tags.exact.size || tags.patterns.length) && (names.exact.size || names.patterns.length)) {
      attributes.push({ tags, names })
    }
  }
  if (globalNames.length) {
    attributes.unshift({ names: compileNames(globalNames) })
  }
  const tags = compileNames(options.tag ?? [])
  const removeTags = tags.exact.size > 0 || tags.patterns.length > 0
  const removeComments = options.comment === true
  if (!attributes.length && !removeTags && !removeComments) {
    return code => code
  }
  const commentOnly = !attributes.length && !removeTags
  return (code, fileName, syntax = 'legacy') => {
    if (!code.includes('<') || (!attributes.length && !removeTags && !code.includes('<!--'))) {
      return code
    }
    const { elements, comments } = scanTemplate(code, fileName, scriptTags, removeComments, syntax, !commentOnly)
    if (commentOnly) {
      let count = 0
      for (const comment of comments) {
        if (!isInstructionComment(code, comment.start, comment.end)) {
          comments[count++] = comment
        }
      }
      comments.length = count
      return applySourceEdits(code, comments, true)
    }
    const ranges: SourceRange[] = []
    let removedElement = false
    for (const node of elements) {
      const matchedTag = removeTags && matches(tags, node.tag)
      if (matchedTag && structuralTags.has(node.tag)) {
        failAt(code, fileName, node.start, `Cannot remove structural tag <${node.tag}>. Use source conditional compilation (#ifdef/#endif) instead.`)
      }
      node.removed = Boolean(node.parent?.removed || matchedTag)
      if (node.removed) {
        if (!node.parent?.removed) {
          ranges.push(node)
          removedElement = true
        }
        continue
      }
      for (const attr of node.attrs) {
        let matched = false
        let exact = false
        for (const rule of attributes) {
          if ((!rule.tags || matches(rule.tags, node.tag)) && matches(rule.names, attr.name)) {
            matched = true
            if (rule.names.exact.has(attr.name)) {
              exact = true
              break
            }
          }
        }
        if (matched && !isProtectedAttribute(code, node, attr, exact)) {
          ranges.push(attr)
        }
      }
    }
    if (removedElement) {
      assertSafeConditionalRemoval(code, fileName, elements)
    }
    for (const comment of comments) {
      if (!isInstructionComment(code, comment.start, comment.end)) {
        ranges.push(comment)
      }
    }
    return applySourceEdits(code, ranges)
  }
}
