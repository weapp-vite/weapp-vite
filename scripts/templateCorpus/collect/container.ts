import assert from 'node:assert/strict'
import { codeToken, expressionEnd, quotedEnd, throughRegion } from './codeRegion'

export interface ContainerTemplate {
  source: string
  start: number
  end: number
}

interface ContainerTag {
  name: string
  closing: boolean
  selfClosing: boolean
  end: number
}

function tagAt(source: string, start: number): ContainerTag | undefined {
  const match = /^<(\/)?([a-z][\w:.-]*)(?=[\s/>]|$)/i.exec(source.slice(start))
  if (!match) {
    return undefined
  }
  for (let index = start + match[0].length; index < source.length; index++) {
    if (source[index] === '"' || source[index] === '\'') {
      index = quotedEnd(source, index) - 1
    }
    else if (source.startsWith('{{', index)) {
      index = expressionEnd(source, index) - 1
    }
    else if (source[index] === '>') {
      return { name: match[2]!.toLowerCase(), closing: Boolean(match[1]), selfClosing: source[index - 1] === '/', end: index + 1 }
    }
  }
  throw new Error('Unterminated container tag')
}

function rawEnd(source: string, start: number, name: string): number {
  let canStartRegexp = true
  for (let index = start; index < source.length;) {
    if (source[index] === '<') {
      const tag = tagAt(source, index)
      if (tag?.closing && tag.name === name) {
        return tag.end
      }
    }
    const token = codeToken(source, index, canStartRegexp, name === 'script')
    index = token.end
    canStartRegexp = token.canStartRegexp
  }
  throw new Error(`Unterminated container ${name} block`)
}

/** 查询唯一显式模板区域；无模板的应用脚本容器返回空值，结构错误仍拒绝。 */
export function findContainerTemplate(source: string): ContainerTemplate | undefined {
  let start: number | undefined
  let result: ContainerTemplate | undefined
  let depth = 0
  for (let index = 0; index < source.length; index++) {
    if (source.startsWith('<!--', index)) {
      index = throughRegion(source, index + 4, '-->') - 1
    }
    else if (source.startsWith('<![CDATA[', index)) {
      index = throughRegion(source, index + 9, ']]>') - 1
    }
    else if (source.startsWith('{{', index)) {
      index = expressionEnd(source, index) - 1
    }
    else if (source[index] === '<') {
      const tag = tagAt(source, index)
      if (!tag) {
        continue
      }
      if (!tag.closing && !tag.selfClosing && (tag.name === 'script' || tag.name === 'style')) {
        index = rawEnd(source, tag.end, tag.name) - 1
        continue
      }
      if (tag.name === 'template') {
        if (tag.selfClosing) {
          assert.ok(depth > 0, 'Self-closing container template has no explicit region')
        }
        else if (tag.closing) {
          assert.ok(depth > 0 && start !== undefined, 'Unexpected container template closing tag')
          depth--
          if (depth === 0) {
            result = { source: source.slice(start, index), start, end: index }
          }
        }
        else {
          if (depth === 0) {
            assert.ok(!result, 'Container has multiple top-level template blocks')
            start = tag.end
          }
          depth++
        }
      }
      index = tag.end - 1
    }
  }
  assert.equal(depth, 0, 'Unterminated container template block')
  return result
}

/** 提取唯一显式模板区域，忽略注释、表达式、脚本与样式中的伪标签。 */
export function extractContainerTemplate(source: string): ContainerTemplate {
  const result = findContainerTemplate(source)
  assert.ok(result, 'Container has no explicit template block')
  return result
}
