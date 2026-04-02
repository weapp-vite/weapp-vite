import type { RouterNavigation } from './types'
import { injectGlobal, provideGlobal } from '../runtime/provide'

const ROUTER_INSTANCE_KEY = Symbol('wevu.router.instance')

let activeRouter: RouterNavigation | undefined

export function setActiveRouter(router: RouterNavigation) {
  activeRouter = router
  provideGlobal(ROUTER_INSTANCE_KEY, router)
}

export function getActiveRouter() {
  return activeRouter ?? injectGlobal<RouterNavigation | undefined>(ROUTER_INSTANCE_KEY, undefined)
}
