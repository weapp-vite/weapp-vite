import type { ResolvedWechatDevtoolsTarget } from './types'
import { AsyncLocalStorage } from 'node:async_hooks'

export const wechatDevtoolsSelectionContext = new AsyncLocalStorage<ResolvedWechatDevtoolsTarget>()
