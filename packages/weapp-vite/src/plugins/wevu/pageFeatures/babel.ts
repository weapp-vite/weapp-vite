import type * as t from '@babel/types'
import { parse as babelParse } from '@babel/parser'
import { BABEL_TS_MODULE_PLUGINS } from '../../../utils/babel'

export { generate, traverse } from '../../../utils/babelTools'

export function parseJsLike(source: string): t.File {
  return babelParse(source, {
    sourceType: 'module',
    plugins: [
      ...BABEL_TS_MODULE_PLUGINS,
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
  }) as unknown as t.File
}
