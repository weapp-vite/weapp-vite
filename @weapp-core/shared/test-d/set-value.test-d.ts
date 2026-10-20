// eslint-disable-next-line e18e/ban-dependencies -- 保留既有公开 set 导出的精确类型身份。
import type setValue from 'set-value'
import { set } from '@weapp-core/shared'
import { expectType } from 'tsd'

expectType<typeof setValue>(set)
expectType<void>(set({}, ['nested', 'value'], 1, { separator: '.' }))
