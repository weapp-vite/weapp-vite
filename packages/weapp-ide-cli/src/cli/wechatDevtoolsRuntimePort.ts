let runtimeWechatDevtoolsServicePort: number | undefined

/**
 * @description 标记当前进程最近一次检测到的微信开发者工具服务端口。
 */
export function setRuntimeWechatDevtoolsServicePort(port: number | undefined) {
  if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) {
    runtimeWechatDevtoolsServicePort = undefined
    return
  }

  runtimeWechatDevtoolsServicePort = port
}

/**
 * @description 读取当前进程最近一次检测到的微信开发者工具服务端口。
 */
export function getRuntimeWechatDevtoolsServicePort() {
  return runtimeWechatDevtoolsServicePort
}
