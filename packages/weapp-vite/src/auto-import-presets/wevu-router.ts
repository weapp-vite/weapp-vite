import { WEVU_DEFINE_PAGE_MACRO, WEVU_ROUTER_MODULE_ID } from '@weapp-core/constants'

type ImportsMap = Record<string, string[]>

const wevuRouter: ImportsMap = {
  [WEVU_ROUTER_MODULE_ID]: [
    WEVU_DEFINE_PAGE_MACRO,
    'createRouter',
    'useRouter',
    'useRoute',
    'useNativeRouter',
    'useNativePageRouter',
    'resolveRouteLocation',
    'parseQuery',
    'stringifyQuery',
    'createNavigationFailure',
    'isNavigationFailure',
  ],
}

export default wevuRouter
