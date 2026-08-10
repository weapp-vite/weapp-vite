/** @jsxImportSource wevu */
import type { Ref } from 'wevu'
import type { WevuJsxElement } from 'wevu/jsx-runtime'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

export const shared = <><view>shared</view></>
export function createPanel(title: string, onTap: () => void) {
  return (
    <view class="panel">
      <text>{title}</text>
      <button onTap={onTap}>tap</button>
    </view>
  )
}
export function createReactiveBlock(count: Ref<number>) {
  return <text>{count.value}</text>
}

export const nativeButton = <button id="submit" size="mini" onTap={() => {}}>submit</button>
export const nativeInput = <input value="hello" onInput={() => {}} />

expectAssignable<WevuJsxElement>(shared)
expectType<WevuJsxElement>(createPanel('title', () => {}))
expectType<WevuJsxElement>(createReactiveBlock({ value: 1 } as Ref<number>))
expectType<WevuJsxElement>(nativeButton)
expectType<WevuJsxElement>(nativeInput)
expectNotAssignable<WevuJsxElement>(Symbol('invalid'))
