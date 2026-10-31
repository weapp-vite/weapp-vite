/* eslint ts/no-require-imports: ["error", { allowAsImport: true }] -- 验证公开 require 条件的类型契约 */
import schematics = require('@weapp-core/schematics')
import { expectType } from 'tsd'

expectType<'App({})' | 'Page({})' | 'Component({})'>(schematics.generateJs('page'))
