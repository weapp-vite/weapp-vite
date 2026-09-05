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
const nativeStructure = (
  <view>
    <cover-image src="/assets/cover.png" onLoad={() => {}} />
    <checkbox-group onChange={() => {}} />
    <radio-group onChange={() => {}} />
    <swiper-item item-id="slide-1" skip-hidden-item-layout />
    <text
      onTap={() => {}}
      onTouchStart={() => {}}
      catchTap={() => {}}
      captureBindTap={() => {}}
      captureCatchTap={() => {}}
    />
  </view>
)

expectType<WevuJsxElement>(nativeButton)
expectType<WevuJsxElement>(nativeView)
expectType<WevuJsxElement>(nativeStructure)
expectError(<view disable-scroll />)
expectError(<button open-type="openAwemeUserProfile" />)
expectError(<scroll-view onWorkletOnscrollstart={() => {}} />)
expectError(<view unknown-attribute />)
expectError(<div />)
