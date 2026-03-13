export const ROUTER_COVERAGE_PATHS = {
  home: '/pages/router-coverage/index',
  mainTarget: '/pages/router-coverage/main-target/index',
  normalSubpackageTarget: '/packages/router-demo/pages/normal-target/index',
  independentSubpackageTarget: '/packages/router-demo-independent/pages/independent-target/index',
  blocked: '/router-coverage/blocked',
  error: '/router-coverage/error',
} as const

export const ROUTER_COVERAGE_TARGETS = [
  {
    key: 'main',
    title: '主包页面',
    summary: '通过 wevu/router 跳转到主包页面',
    path: ROUTER_COVERAGE_PATHS.mainTarget,
  },
  {
    key: 'subpackage',
    title: '普通分包页面',
    summary: '通过 wevu/router 跳转到普通分包页面',
    path: ROUTER_COVERAGE_PATHS.normalSubpackageTarget,
  },
  {
    key: 'independent',
    title: '独立分包页面',
    summary: '通过 wevu/router 跳转到独立分包页面',
    path: ROUTER_COVERAGE_PATHS.independentSubpackageTarget,
  },
] as const
