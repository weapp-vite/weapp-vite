/** @jsxImportSource wevu/miniprogram */
import type { WevuJsxElement } from 'wevu/miniprogram/jsx-runtime'
import { expectError, expectType } from 'tsd'

const commonButton = (
  <button
    size="mini"
    type="primary"
    form-type="submit"
    open-type="share"
    onTap={() => {}}
  />
)
const commonInput = <input type="digit" onInput={() => {}} />
const commonScrollView = <scroll-view onScrollToUpper={() => {}} />
const commonText = <text space="ensp" onTap={() => {}} onTouchStart={() => {}} />

expectType<WevuJsxElement>(commonButton)
expectType<WevuJsxElement>(commonInput)
expectType<WevuJsxElement>(commonScrollView)
expectType<WevuJsxElement>(commonText)
expectError(<button type="warn" />)
expectError(<input type="idcard" />)
expectError(<view disable-scroll />)
expectError(<button open-type="getRealtimePhoneNumber" />)
expectError(<button open-type="openAwemeUserProfile" />)
expectError(<mask />)
expectError(<view unknown-attribute />)
