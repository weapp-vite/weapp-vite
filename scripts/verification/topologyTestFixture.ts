import process from 'node:process'
import { beforeEach } from 'vitest'
import { TOPOLOGY_ENV, TOPOLOGY_POLICY_ENV } from './topology.ts'

const topologyKeys = [TOPOLOGY_ENV, TOPOLOGY_POLICY_ENV] as const

/** 仅隔离测试自行构造的拓扑输入，保留并精确恢复调用者的两个环境变量。 */
export function isolateTopologyTestEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const inherited = topologyKeys.map(key => [key, env[key]] as const)
  for (const key of topologyKeys) {
    delete env[key]
  }
  return () => {
    for (const [key, value] of inherited) {
      if (value === undefined) {
        delete env[key]
      }
      else {
        env[key] = value
      }
    }
  }
}

/** 测试结束钩子在各文件的 mock 收尾后恢复身份，不影响配置解析或生产继承。 */
export function useIsolatedTopologyTestEnvironment() {
  beforeEach(({ onTestFinished }) => {
    onTestFinished(isolateTopologyTestEnvironment())
  })
}
