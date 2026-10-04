import process from 'node:process'
import { acquireMachineE2ELease } from '../../src/lease/machine'

async function main() {
  try {
    const lease = await acquireMachineE2ELease({ stateDirectory: process.argv[2] })
    const finish = async () => {
      await lease.release()
      process.exit(0)
    }
    const onFinish = () => {
      void finish()
    }
    process.on('message', onFinish)
    process.on('SIGTERM', onFinish)
    process.on('SIGINT', onFinish)
    process.send?.({ ready: true, borrowed: lease.borrowed, environment: lease.environment })
  }
  catch (error) {
    process.send?.({ error: error instanceof Error ? error.message : String(error) })
    process.exitCode = 1
    process.disconnect?.()
  }
}

void main()
