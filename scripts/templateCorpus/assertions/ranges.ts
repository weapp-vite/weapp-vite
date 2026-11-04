import type { Attribute, Document, SourceRange, TagToken } from '../../../packages/wxml/src/types'
import { invariant } from './types'

function range(value: SourceRange, source: string, parent: SourceRange, label: string) {
  invariant(Number.isInteger(value.start) && Number.isInteger(value.end), 'ranges', `${label}: noninteger UTF-16 offset`)
  invariant(value.start >= parent.start && value.end >= value.start && value.end <= parent.end && value.end <= source.length, 'ranges', `${label}: range outside parent`)
}

function attributes(tag: TagToken, source: string) {
  let previous = tag.nameEnd
  for (const attribute of tag.attributes) {
    range(attribute, source, tag, `attribute ${attribute.name}`)
    invariant(attribute.start >= previous, 'attributes', 'attribute order changed or ranges overlap')
    range({ start: attribute.nameStart, end: attribute.nameEnd }, source, attribute, 'attribute name')
    invariant(source.slice(attribute.nameStart, attribute.nameEnd) === attribute.name, 'attributes', 'attribute name disagrees with source')
    if (attribute.value === undefined) {
      invariant(attribute.valueStart === undefined && attribute.valueEnd === undefined && attribute.rawValue === undefined && attribute.quote === undefined, 'attributes', 'bare attribute has a value range')
    }
    else {
      invariant(attribute.valueStart !== undefined && attribute.valueEnd !== undefined, 'attributes', 'valued attribute is missing a range')
      range({ start: attribute.valueStart, end: attribute.valueEnd }, source, attribute, 'attribute value')
      invariant(source.slice(attribute.valueStart, attribute.valueEnd) === attribute.value, 'attributes', 'attribute value disagrees with source')
      const rawStart = attribute.valueStart - (attribute.quote ? 1 : 0)
      invariant(source.slice(rawStart, attribute.end) === attribute.rawValue, 'attributes', 'raw attribute disagrees with source')
      if (attribute.quote) {
        invariant(source[rawStart] === attribute.quote && source[attribute.end - 1] === attribute.quote, 'attributes', 'quote metadata disagrees with source')
      }
    }
    previous = attribute.end
  }
}

/** 完整 tokens 必须恰好分区源码，标签配对用独立栈验证。 */
export function assertRanges(document: Document) {
  const { source, tokens } = document
  let cursor = 0
  const stack: number[] = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!
    range(token, source, { start: 0, end: source.length }, 'token')
    invariant(token.start === cursor, 'partition', `token ${index} leaves a gap or overlap at ${cursor}`)
    cursor = token.end
    if (token.kind !== 'tag') {
      continue
    }
    range({ start: token.nameStart, end: token.nameEnd }, source, token, 'tag name')
    invariant(source.slice(token.nameStart, token.nameEnd) === token.name, 'tags', 'tag name disagrees with source')
    attributes(token, source)
    if (token.closing) {
      const openingIndex = stack.pop()
      const opening = openingIndex === undefined ? undefined : tokens[openingIndex]
      invariant(opening?.kind === 'tag' && opening.name === token.name, 'tags', 'closing tag does not match independent stack')
      invariant(token.matching === openingIndex && opening.matching === index, 'tags', 'matching indices disagree')
      invariant(token.parent === opening.parent, 'tags', 'closing parent disagrees')
    }
    else {
      invariant(token.parent === stack[stack.length - 1], 'tags', 'parent index disagrees')
      if (!token.selfClosing) {
        stack.push(index)
      }
      else {
        invariant(token.matching === undefined, 'tags', 'self-closing tag has matching index')
      }
    }
  }
  invariant(cursor === source.length && stack.length === 0, 'partition', 'tokens do not consume the complete source or leave tags open')
}

export function attributeShape(attribute: Attribute) {
  return [attribute.name, attribute.value, attribute.quote, attribute.start, attribute.end]
}
