import type { AutomatorPortLease } from '@weapp-vite/miniprogram-automator'
import { acquireAutomatorPortLease } from '@weapp-vite/miniprogram-automator'
import { expectType } from 'tsd'

expectType<Promise<AutomatorPortLease>>(acquireAutomatorPortLease())
expectType<Promise<AutomatorPortLease>>(acquireAutomatorPortLease(58_802))
