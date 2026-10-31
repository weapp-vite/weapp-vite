/* eslint ts/no-require-imports: ["error", { allowAsImport: true }] -- 验证公开 require 条件的类型契约 */
import i18n = require('@weapp-vite/i18n')
import compiler = require('@weapp-vite/i18n/compiler')
import runtime = require('@weapp-vite/i18n/runtime')
import { expectType } from 'tsd'

const instance = i18n.createI18n({
  locale: 'en-US',
  messages: { 'en-US': { greeting: 'Hello' } },
})

expectType<i18n.I18nInstance>(instance)
expectType<runtime.I18nInstance>(instance)
expectType<runtime.I18nInstance>(runtime.createI18n({
  locale: 'en-US',
  messages: { 'en-US': { greeting: 'Hello' } },
}))
expectType<i18n.I18nMessageToken[]>(compiler.compileI18nMessage('Hello {name}'))
