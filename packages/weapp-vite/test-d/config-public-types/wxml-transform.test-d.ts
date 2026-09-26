import type { WxmlTransform as ConfigTransform } from 'weapp-vite/config'
import type { WeappViteConfig, WxmlAttributeValue, WxmlElementInfo, WxmlTransform, WxmlTransformContext, WxmlTransformNode } from 'weapp-vite/types'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

const transform: WxmlTransform = async (code, ctx) => ctx.edit(code, async (node) => {
  expectType<WxmlTransformNode>(node)
  expectType<readonly WxmlTransformNode[]>(node.children)
  expectType<readonly WxmlElementInfo[] | undefined>(node.parent?.children)
  // @ts-expect-error 父节点的子节点观察不允许编辑。
  node.parent?.children[0]?.setAttribute('value', 'invalid')
  // @ts-expect-error 子节点集合不可修改。
  node.children.push(node)
  expectType<Promise<void>>(node.walk(async (child) => {
    expectType<WxmlTransformNode>(child)
    child.setAttribute('value', 'nested')
    child.skipChildren()
  }))
  node.skipChildren()
  expectType<string | null | undefined>(node.getAttribute('data-test')?.rawValue)
  node.setAttribute('disabled', false)
  node.setAttribute('count', 1)
  node.setAttribute('label', '中文')
  node.setAttribute('value', { expression: 'value' })
  node.setBooleanAttribute('enabled')
  node.renameAttribute('data-test', 'data-track')
  node.removeAttribute('data-debug')
  node.renameTag('view')
})
expectAssignable<ConfigTransform>(transform)
expectAssignable<WeappViteConfig>({ wxml: { transform: [transform, () => null, () => ''] } })
expectNotAssignable<WxmlAttributeValue>(null)
expectNotAssignable<WxmlAttributeValue>({ expression: 1 })
expectNotAssignable<WxmlTransform>(() => 1)
expectNotAssignable<WeappViteConfig>({ wxml: { transform: 'replace' } })
defineConfig({ weapp: { wxml: { transform(code, ctx) {
  expectType<string>(code)
  expectType<WxmlTransformContext>(ctx)
  expectType<string | undefined>(ctx.subPackageRoot)
  ctx.addWatchFile('rules.json')
  return ctx.edit(code, (node) => {
    node.removeAttribute('data-testid')
  })
} } } })
