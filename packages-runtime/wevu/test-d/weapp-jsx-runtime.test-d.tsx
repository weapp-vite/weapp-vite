/** @jsxImportSource wevu/weapp */
import type { WeappIntrinsicElements, WevuJsxElement } from 'wevu/weapp/jsx-runtime'
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
// JSX 允许未知连字符属性；用对象属性集合检查平台边界。
expectError({ 'disable-scroll': true } satisfies WeappIntrinsicElements['view'])
expectError(<button open-type="openAwemeUserProfile" />)
expectError(<scroll-view onWorkletOnscrollstart={() => {}} />)
expectError(<view unknownAttribute />)
expectError(<div />)
