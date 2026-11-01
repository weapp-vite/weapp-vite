/* eslint ts/no-require-imports: ["error", { allowAsImport: true }] -- 验证插件可直接通过 require 获得 */
import type { SFCParseResult } from '@vue/compiler-sfc'
import type { VueLanguagePlugin } from '@vue/language-core'
import type ts from 'typescript'
import plugin = require('@weapp-vite/volar')
import { expectType } from 'tsd'

expectType<VueLanguagePlugin>(plugin)

declare const context: Parameters<typeof plugin>[0]
declare const languagePlugin: Exclude<ReturnType<typeof plugin>, unknown[]>

expectType<typeof ts>(context.modules.typescript)
expectType<SFCParseResult | undefined>(languagePlugin.parseSFC2?.('consumer.vue', 'vue', '<template />'))
