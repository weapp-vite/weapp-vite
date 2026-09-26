import type { AlipayIntrinsicElements, MiniProgramIntrinsicElements, TtIntrinsicElements, WeappIntrinsicElements } from '@weapp-core/types'
import type { WeappIntrinsicElementBaseAttributes } from '@weapp-core/types/weapp'

const button: WeappIntrinsicElements['button'] = { onTap: () => {} }
const base: WeappIntrinsicElementBaseAttributes = { id: 'x', className: 'foo' }
const alipay: AlipayIntrinsicElements['view'] = { id: 1 }
const tt: TtIntrinsicElements['view'] = { id: 1 }
const mini: MiniProgramIntrinsicElements['view'] = { id: 1 }
void [button, base, alipay, tt, mini]
