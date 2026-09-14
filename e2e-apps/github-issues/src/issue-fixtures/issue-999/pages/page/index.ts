/* eslint-disable ts/no-require-imports */
require('../../subs/page/callback.ts', () => {}, () => {})
const promise = require.async('../../subs/page/promise.ts')
const native = import('../../subs/page/native.ts')

Page({ promise, native })
