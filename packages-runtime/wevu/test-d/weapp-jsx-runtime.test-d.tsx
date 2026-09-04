/** @jsxImportSource wevu/weapp */
import type { WevuJsxElement } from 'wevu/weapp/jsx-runtime'
import { expectError, expectType } from 'tsd'

const nativeButton = (
  <button
    open-type="getRealtimePhoneNumber"
    onGetRealtimePhoneNumber={() => {}}
  />
)
const nativeView = <view className="panel" onTap={() => {}} />

expectType<WevuJsxElement>(nativeButton)
expectType<WevuJsxElement>(nativeView)
expectError(<view disable-scroll />)
expectError(<button open-type="openAwemeUserProfile" />)
expectError(<scroll-view onWorkletOnscrollstart={() => {}} />)
expectError(<view unknown-attribute />)
expectError(<div />)
