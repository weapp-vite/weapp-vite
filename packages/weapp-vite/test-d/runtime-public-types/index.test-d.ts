import type { LayoutHostBridge } from 'weapp-vite/runtime'
import { expectType } from 'tsd'
import {
  registerLayoutHosts,
  resolveLayoutHost,
  unregisterLayoutHosts,
  waitForLayoutHost,
} from 'weapp-vite/runtime'

const layoutBridge = registerLayoutHosts({
  'layout-toast': {
    show() {},
  },
})

expectType<LayoutHostBridge | null>(layoutBridge)
expectType<{ show: () => void } | null>(resolveLayoutHost<{ show: () => void }>('layout-toast'))
expectType<Promise<{ show: () => void } | null>>(waitForLayoutHost<{ show: () => void }>('layout-toast'))
expectType<boolean>(unregisterLayoutHosts(layoutBridge))
