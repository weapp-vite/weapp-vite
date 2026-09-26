import type { WevuJsxEventHandler } from 'wevu/jsx-runtime'
import type { WeappIntrinsicElements } from 'wevu/weapp/jsx-runtime'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

interface TapEvent {
  currentTarget: { dataset: { index: number } }
}

const handleTap = (event: TapEvent) => event.currentTarget.dataset.index
const handleOptionalTap = (event?: TapEvent) => event?.currentTarget.dataset.index

expectAssignable<WevuJsxEventHandler>(handleTap)
expectAssignable<WevuJsxEventHandler>(handleOptionalTap)
expectAssignable<WeappIntrinsicElements['view']>({ onTap: handleTap })
expectAssignable<WeappIntrinsicElements['view']>({ catchTap: handleTap })
expectAssignable<WeappIntrinsicElements['view']>({ captureBindTap: handleTap })
expectAssignable<WeappIntrinsicElements['view']>({ captureCatchTap: handleTap })
expectAssignable<WevuJsxEventHandler<number>>(handleTap)
expectNotAssignable<WevuJsxEventHandler<string>>(handleTap)
expectNotAssignable<WevuJsxEventHandler>('handleTap')
expectNotAssignable<WeappIntrinsicElements['view']>({ onTap: 1 })

declare const handler: WevuJsxEventHandler<number>
expectType<number>(handler({ currentTarget: { dataset: { index: 1 } } }))
