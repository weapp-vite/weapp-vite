import { createDevProcessEnv } from '../../e2e/utils/dev-process-env'

/** 基准保留正常的侧车监听；诊断环境不能关闭 sitemap 等静态资源的更新入口。 */
export function createBenchmarkDevEnv(nodeOptions?: string): NodeJS.ProcessEnv {
  return {
    ...createDevProcessEnv({ nodeOptions }),
    WEAPP_VITE_DISABLE_SIDECAR_WATCH: '0',
  }
}
