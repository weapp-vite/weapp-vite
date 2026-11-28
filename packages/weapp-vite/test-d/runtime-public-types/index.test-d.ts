import type { LayoutHostBridge } from 'weapp-vite/runtime'
import { expectType } from 'tsd'
import {
  registerLayoutHosts,
  resolveLayoutHost,
  unregisterLayoutHosts,
  waitForLayoutHost,
} from 'weapp-vite/runtime'
import { ensureWebRuntimeHeaders } from 'weapp-vite/web-apis/runtime-ensure'
import { ensureWebRuntimeGlobal, markWebRuntimeGlobalInstalled, shouldInstallWebRuntimeGlobal } from 'weapp-vite/web-apis/runtime-global'

const layoutBridge = registerLayoutHosts({
  'layout-toast': {
    show() {},
  },
})

expectType<LayoutHostBridge | null>(layoutBridge)
expectType<{ show: () => void } | null>(resolveLayoutHost<{ show: () => void }>('layout-toast'))
expectType<Promise<{ show: () => void } | null>>(waitForLayoutHost<{ show: () => void }>('layout-toast'))
expectType<boolean>(unregisterLayoutHosts(layoutBridge))
expectType<boolean>(shouldInstallWebRuntimeGlobal(undefined))
expectType<unknown>(ensureWebRuntimeGlobal(undefined, fetch))
expectType<unknown>(ensureWebRuntimeHeaders(undefined, Headers))
expectType<typeof fetch>(markWebRuntimeGlobalInstalled(fetch))
