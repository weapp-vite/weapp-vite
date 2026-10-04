import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'

const runtimePorts = new Map<string, number>()
type PortTarget = Pick<ResolvedWechatDevtoolsTarget, 'installationId'>

/**
 * @description 标记所选安装检测到的服务端口；无身份的旧调用仅保留在独立兼容槽中。
 */
export function setRuntimeWechatDevtoolsServicePort(port: number | undefined, target?: PortTarget) {
  const key = target?.installationId ?? ''
  if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) {
    runtimePorts.delete(key)
    return
  }

  runtimePorts.set(key, port)
}

/**
 * @description 只读取所选安装的服务端口，不借用其他安装或无身份的旧记录。
 */
export function getRuntimeWechatDevtoolsServicePort(target?: PortTarget) {
  return runtimePorts.get(target?.installationId ?? '')
}
