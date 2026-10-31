import type { OxfmtConfig } from 'vite-plus/fmt'
import { recommended } from '@weapp-vite/oxfmt'
import { formatDocument } from '@weapp-vite/oxfmt/languages'
import { loadProjectConfig, resolveDocumentFormatOptions } from '@weapp-vite/oxfmt/project'
import { formatWxml } from '@weapp-vite/oxfmt/wxml'
import { expectAssignable, expectType } from 'tsd'

expectAssignable<OxfmtConfig>(recommended)
expectType<'strict'>(recommended.htmlWhitespaceSensitivity)
expectType<false>(recommended.sortPackageJson)
expectAssignable<Array<{ files: string[], language: 'css' }>>(recommended.associations)
expectType<Promise<string>>(formatWxml('<text>  {{label}}  </text>'))
expectType<Promise<string>>(formatWxml('<view/>', 'page.wxml', { printWidth: 80 }))
expectType<Promise<string>>(formatDocument('<view/>', 'page.axml', { platform: 'alipay', printWidth: 80 }))
expectType<Promise<string>>(formatDocument('module.exports = {}', 'module.wxs'))
void loadProjectConfig('.')
expectType<string>(resolveDocumentFormatOptions('src/page.wxml', recommended).fileName)
