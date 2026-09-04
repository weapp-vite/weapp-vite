/** @jsxImportSource wevu/tt */
import type { WevuJsxElement } from 'wevu/tt/jsx-runtime'
import { expectError, expectType } from 'tsd'

const profileButton = <button open-type="openAwemeUserProfile" />
const nativeInput = <input type="digit" onInput={() => {}} />
const nativeMask = <mask />

expectType<WevuJsxElement>(profileButton)
expectType<WevuJsxElement>(nativeInput)
expectType<WevuJsxElement>(nativeMask)
expectError(<view disable-scroll />)
expectError(<input controlled />)
expectError(<button open-type="getRealtimePhoneNumber" />)
expectError(<view unknown-attribute />)
