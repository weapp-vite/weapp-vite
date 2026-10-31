/* eslint ts/no-require-imports: ["error", { allowAsImport: true }] -- 验证公开 require 条件的类型契约 */
import type { VueLanguagePlugin } from '@vue/language-core'
import { expectType } from 'tsd'
import plugin from 'weapp-vite/volar'
import requiredPlugin = require('weapp-vite/volar')

expectType<VueLanguagePlugin>(plugin)
expectType<VueLanguagePlugin>(requiredPlugin)
