import type getValue from 'get-value'
import { get } from '@weapp-core/shared'
import { expectError, expectType } from 'tsd'

expectType<typeof getValue>(get)

const source = { nested: { value: 1 } } as const
expectType<typeof source>(get(source))
expectType<'literal'>(get('literal' as const))
expectType<undefined>(get(undefined))

const options: get.Options = {
  default: 'fallback',
  isValid: (key, object) => key in object,
  split: value => value.split('/'),
  separator: /[/.]/,
  join: segments => segments.join('/'),
  joinChar: '/',
}
expectType<getValue.Options>(options)
expectType<get.Options>({} as getValue.Options)

// 路径重载保留上游返回类型，不把未知路径值收窄为自定义类型。
expectType<any>(get(source, 'nested.value'))
expectType<any>(get(source, ['nested', 'value'], options))

expectError(get(source, 1))
expectError(get(source, ['nested', 1]))
expectError(get(source, 'nested', { separator: 1 }))
expectError(get(source, 'nested', { split: () => 'nested' }))
expectError(get(source, 'nested', { join: () => ['nested'] }))
