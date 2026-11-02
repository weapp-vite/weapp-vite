import process from 'node:process'

/** 不让工作区 loader 或模块查找路径进入普通 npm 消费端；保留机器租约等所有权变量。 */
export function importsConsumerEnvironment() {
  const env = { ...process.env }
  delete env.NODE_OPTIONS
  delete env.NODE_PATH
  return env
}
