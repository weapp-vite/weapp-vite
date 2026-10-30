import type { OxfmtConfig } from 'vite-plus/fmt'
import { recommended } from '@weapp-vite/oxfmt'
import { formatWxml } from '@weapp-vite/oxfmt/wxml'
import { expectAssignable, expectType } from 'tsd'

expectAssignable<OxfmtConfig>(recommended)
expectType<'strict'>(recommended.htmlWhitespaceSensitivity)
expectType<false>(recommended.sortPackageJson)
expectAssignable<Array<{ files: string[], language: 'css' }>>(recommended.associations)
expectType<Promise<string>>(formatWxml('<text>  {{label}}  </text>'))
expectType<Promise<string>>(formatWxml('<view/>', 'page.wxml', { printWidth: 80 }))
