import process from 'node:process'
import { acquireMachineE2ELease } from '../packages/devtools-runtime/src/lease/machine'

/** 在任何 IDE 预检或测试 worker 启动之前获取同机 E2E 租约。 */
export default async function setup() {
  const lease = await acquireMachineE2ELease()
  const previous = Object.fromEntries(Object.keys(lease.environment).map(key => [key, process.env[key]]))
  Object.assign(process.env, lease.environment)
  return async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = value
      }
    }
    await lease.release()
  }
}
