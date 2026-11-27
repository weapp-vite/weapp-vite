// 启动页依赖与页面验收依赖保持分离，避免 shared chunk 把页面级 Web API 提前到 App 启动。
export const appSharedRouteLabel = 'shared-runtime'
