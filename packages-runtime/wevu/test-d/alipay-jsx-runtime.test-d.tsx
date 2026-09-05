/** @jsxImportSource wevu/alipay */
import type { WevuJsxElement } from 'wevu/alipay/jsx-runtime'
import { expectError, expectType } from 'tsd'

const nativeView = <view disable-scroll onTap={() => {}} />
const nativeInput = <input controlled type="numberpad" onInput={() => {}} />
const authorizeButton = (
  <button
    open-type="getAuthorize"
    scope="phoneNumber"
    onGetAuthorize={() => {}}
  />
)

expectType<WevuJsxElement>(nativeView)
expectType<WevuJsxElement>(nativeInput)
expectType<WevuJsxElement>(authorizeButton)
expectError(<button open-type="getRealtimePhoneNumber" />)
expectError(<button open-type="openAwemeUserProfile" />)
expectError(<view unknownAttribute />)

expectType<WevuJsxElement>(<picker-view value={[0, 1]} onChange={() => {}} />)
expectType<WevuJsxElement>(<picker range={['A', 'B']} value={0} onChange={() => {}} />)
expectType<WevuJsxElement>(<picker range={[{ label: 'A' }]} range-key="label" />)
expectError(<picker-view value={0} />)
expectError(<picker-view value={['0']} />)
expectError(<picker range="A" />)
