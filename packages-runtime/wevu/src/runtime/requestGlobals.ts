import { installAbortGlobals } from '../../../web-apis/src'

/**
 * 为未经过 weapp-vite 编译期注入的运行时兜底安装中止控制器全局对象。
 */
export function installRuntimeAbortGlobals() {
  return installAbortGlobals()
}
