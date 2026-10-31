import type { ExpressionIdentifier } from './templateIdentifiers'
import { getTemplateAnalysis } from './templateAnalysis'
import { getExpressionIdentifiers } from './templateIdentifiers'

/** 原生事件遵守平台 profile；Vue 事件保留 @ 简写的独立适配。 */
export function getTemplateEventExpressions(source: string, fileName: string) {
  const analysis = getTemplateAnalysis(source, fileName)
  const events = analysis.references.filter(reference => reference.kind === 'event')
    .map(reference => ({ source: reference.name, start: reference.start, end: reference.end }))
  if (/\.vue$/iu.test(fileName)) {
    for (const tag of analysis.elements) {
      for (const attribute of tag.attributes) {
        if ((attribute.name.startsWith('@') || attribute.name.startsWith('v-on:')) && attribute.value != null && attribute.valueStart != null && attribute.valueEnd != null) {
          events.push({ source: attribute.value, start: attribute.valueStart, end: attribute.valueEnd })
        }
      }
    }
  }
  return events.map((event) => {
    const expression = analysis.expressions.find(expression => expression.fullStart === event.start && expression.fullEnd === event.end)
    return expression ?? event
  })
}

/** 事件成员只从真实标识符根向下解析，字符串、注释及对象字面量不成为符号。 */
export function getEventExpressionIdentifiers(expression: string, start: number) {
  const identifiers = getExpressionIdentifiers(expression, start)
  const members: ExpressionIdentifier[] = []
  for (const root of identifiers) {
    let cursor = root.end - start
    for (;;) {
      const member = /^(?:\?\.|\.)\s*([$_\p{ID_Start}][$\p{ID_Continue}]*)/u.exec(expression.slice(cursor))
      if (!member) {
        break
      }
      const name = member[1]
      const memberStart = start + cursor + member[0].lastIndexOf(name)
      members.push({ name, start: memberStart, end: memberStart + name.length })
      cursor += member[0].length
    }
  }
  return [...identifiers, ...members].sort((left, right) => left.start - right.start)
}
