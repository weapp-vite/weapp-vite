/** @jsxImportSource wevu/tt */
import type { TtIntrinsicElements, WevuJsxElement } from 'wevu/tt/jsx-runtime'
import { expectError, expectType } from 'tsd'

const profileButton = <button open-type="openAwemeUserProfile" />
const nativeInput = <input type="digit" onInput={() => {}} />
const nativeMask = <mask />

expectType<WevuJsxElement>(profileButton)
expectType<WevuJsxElement>(nativeInput)
expectType<WevuJsxElement>(nativeMask)
// JSX 允许未知连字符属性；用对象属性集合检查平台边界。
expectError({ 'disable-scroll': true } satisfies TtIntrinsicElements['view'])
expectError(<input controlled />)
expectError(<button open-type="getRealtimePhoneNumber" />)
expectError(<view unknownAttribute />)

expectType<WevuJsxElement>(<picker-view value={[0, 1]} onChange={() => {}} />)
expectType<WevuJsxElement>(<picker mode="selector" range={['A', { label: 'B' }]} range-key="label" value={0} onChange={() => {}} />)
expectType<WevuJsxElement>(<picker mode="multiSelector" range={[[{ label: 'A' }, 'B'], ['C']]} value={[0, 1]} onColumnchange={() => {}} />)
expectType<WevuJsxElement>(<picker mode="time" value="12:00" start="09:00" end="18:00" onChange={() => {}} />)
expectType<WevuJsxElement>(<picker mode="date" value="2026-09-05" start="2026-01-01" end="2026-12-31" fields="day" />)
expectType<WevuJsxElement>(<picker mode="region" value={['北京', '北京市', '西城区']} custom-item="全部" />)
expectError(<picker-view value={0} />)
expectError(<picker range="A" />)
expectError(<picker range={[true]} />)
expectError(<picker value={true} />)
expectError(<picker fields="week" />)
