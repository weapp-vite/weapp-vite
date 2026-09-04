/** @jsxImportSource wevu */
import type { Ref } from 'wevu'
import type { WevuJsxElement } from 'wevu/jsx-runtime'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'

function Panel(props: { count: Ref<number>, title: string }) {
  return props.title
}

export const panel = <Panel count={{ value: 1 }} title="neutral" />

expectAssignable<WevuJsxElement>(panel)
expectType<WevuJsxElement>(panel)
expectError(<Panel count={{ value: 1 }} />)
expectError(<view />)
expectError(<arbitrary-native-tag />)
expectNotAssignable<WevuJsxElement>(Symbol('invalid'))
