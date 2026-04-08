import { expectType } from 'tsd'
import { resolveLayoutBridge, resolveLayoutHost } from 'wevu'

const bridge = resolveLayoutBridge('#layout-host', {
  route: 'pages/index/index',
})
expectType<((selector: string) => any) | undefined>(bridge?.selectComponent)

const host = resolveLayoutHost<{ show: () => void }>('#layout-host', {
  context: {
    route: 'pages/index/index',
  },
})
expectType<(() => void) | undefined>(host?.show)
