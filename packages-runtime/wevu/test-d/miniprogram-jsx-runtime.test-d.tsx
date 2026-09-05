/** @jsxImportSource wevu/miniprogram */
import type { MiniprogramIntrinsicElements, WevuJsxElement } from 'wevu/miniprogram/jsx-runtime'
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
// JSX 允许未知连字符属性；用对象属性集合检查平台边界。
expectError({ 'disable-scroll': true } satisfies MiniprogramIntrinsicElements['view'])
expectError(<button open-type="getRealtimePhoneNumber" />)
expectError(<button open-type="openAwemeUserProfile" />)
expectError(<mask />)
expectError(<view unknownAttribute />)
expectType<WevuJsxElement>(<picker-view value={[0, 1]} onChange={() => {}} />)
expectError(<picker-view value={0} />)
expectError(<picker-view value={['0']} />)
