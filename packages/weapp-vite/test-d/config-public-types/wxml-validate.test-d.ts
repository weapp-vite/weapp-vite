import type { WxmlValidate as ConfigValidate } from 'weapp-vite/config'
import type { WeappViteConfig, WxmlElementInfo, WxmlValidate, WxmlValidationContext, WxmlValidationDiagnostic, WxmlValidationVisitor } from 'weapp-vite/types'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

const visitor: WxmlValidationVisitor = async (node) => {
  expectType<WxmlElementInfo>(node)
  expectType<readonly WxmlElementInfo[]>(node.children)
  expectError(node.children[0]?.remove())
  expectError(node.children.push(node))
  expectError(node.walk(visitor))
  expectError(node.skipChildren())
  expectType<string | null | undefined>(node.getAttribute('value')?.rawValue)
  expectError(node.remove())
  expectError(node.setAttribute('value', 'changed'))
  expectError(node.tagName = 'text')
  expectError(node.attributes.push({ name: 'x', rawValue: null, quote: undefined }))
}
const validate: WxmlValidate = async (code, ctx) => {
  expectType<string>(code)
  expectType<WxmlValidationContext>(ctx)
  expectType<string | undefined>(ctx.subPackageRoot)
  ctx.addWatchFile('rules.json')
  await ctx.walk(visitor)
  ctx.report({ severity: 'warning', message: '校验提示' })
  expectError(ctx.edit(code, visitor))
}
expectAssignable<ConfigValidate>(validate)
expectAssignable<WeappViteConfig>({ wxml: { validate: [validate, () => {}] } })
expectNotAssignable<WxmlValidationDiagnostic>({ severity: 'info', message: '提示' })
expectNotAssignable<WeappViteConfig>({ wxml: { validate: true } })
defineConfig(({ mode }) => ({ weapp: { wxml: { validate: async (code, ctx) => {
  expectType<string>(code)
  expectType<WxmlValidationContext>(ctx)
  if (mode === 'production') {
    await ctx.walk(node => ctx.report({ severity: 'error', code: 'rule', message: node.tagName, location: node.location }))
  }
} } } }))
