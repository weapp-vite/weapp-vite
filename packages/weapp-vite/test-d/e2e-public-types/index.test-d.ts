import { expectType } from 'tsd'
import { launchAutomator } from 'weapp-vite/e2e'

expectType<typeof launchAutomator>(launchAutomator)
