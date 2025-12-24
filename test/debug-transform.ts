import { baseParse as parse } from '@vue/compiler-core'
import { NodeTypes } from '@vue/compiler-core'

const template = '<view v-if="visible">Show me</view>'

const ast = parse(template)

console.log('=== Transforming ===')
console.log('ast.children:', ast.children)
console.log('ast.children[0]:', ast.children[0])

const element = ast.children[0]
console.log('element.type:', element?.type)
console.log('element.type === NodeTypes.ELEMENT:', element?.type === NodeTypes.ELEMENT)

// 手动执行转换逻辑
const { type, directive } = (() => {
  for (const prop of element.props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else') {
        return { type: 'if', directive: prop }
      }
      if (prop.name === 'for') {
        return { type: 'for', directive: prop }
      }
    }
  }
  return { type: null, directive: undefined }
})()

console.log('Detected structural directive:', { type, directive })
console.log('directive.name:', directive?.name)
console.log('directive.exp:', directive?.exp)

// 现在尝试生成输出
const ifDirective = element.props.find(
  (prop) => prop.type === NodeTypes.DIRECTIVE &&
  (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else')
)
console.log('ifDirective:', ifDirective)

const otherProps = element.props.filter(prop => prop !== ifDirective)
console.log('otherProps:', otherProps)

const content = 'Show me'
const dir = ifDirective
if (dir?.name === 'if' && dir.exp) {
  const expValue = dir.exp.content
  const output = `<block wx:if="{{${expValue}}}">${content}</block>`
  console.log('Generated output:', output)
}
