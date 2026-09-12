type ImportsMap = Record<string, string[]>

const wevuRouter: ImportsMap = {
  'wevu/router': [
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
