import process from 'node:process'
import { beforeEach } from 'vitest'
import { useIsolatedTopologyTestEnvironment } from '../verification/topologyTestFixture.ts'

const captureKeys = [
  ...['TASK_FILTER', 'TASK_FROM', 'TASK_ROLL_FROM', 'SHARD_INDEX', 'SHARD_TOTAL', 'TEMPLATE', 'TARGET_FILE', 'EXCLUDE_PROJECTS', 'ACCEPTANCE_CASES', 'CI_SKIP_HMR_GUARD', 'DOM_ACCEPTANCE', 'RUNTIME_PROVIDER']
    .map(key => `WEAPP_VITE_E2E_${key}`),
  'WEAPP_VITE_VERIFICATION_LOCAL_DIR',
]

/** 隔离模拟采集的调用者范围，并在 mock 收尾后原样恢复继承环境。 */
export function isolateCaptureTestEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const inherited = captureKeys.map(key => [key, env[key]] as const)
  for (const key of captureKeys) {
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

/** 仅作用于自行构造采集输入的测试，不改变正式采集或子进程继承。 */
export function useIsolatedCaptureTestEnvironment() {
  useIsolatedTopologyTestEnvironment()
  beforeEach(({ onTestFinished }) => {
    onTestFinished(isolateCaptureTestEnvironment())
  })
}
