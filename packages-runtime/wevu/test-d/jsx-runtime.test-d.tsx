/** @jsxImportSource wevu */
import type { Ref } from 'wevu'
import type { WevuJsxElement } from 'wevu/jsx-runtime'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'
import { ref } from 'wevu'

function Panel(props: { count: Ref<number>, title: string }) {
  return props.title
}

const count = ref(1)
export const panel = <Panel count={count} title="neutral" />

expectAssignable<WevuJsxElement>(panel)
expectType<WevuJsxElement>(panel)
expectError(<Panel count={count} />)
expectError(<view />)
expectError(<arbitrary-native-tag />)
expectNotAssignable<WevuJsxElement>(Symbol('invalid'))
