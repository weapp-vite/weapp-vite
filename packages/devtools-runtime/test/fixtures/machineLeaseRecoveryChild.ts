import process from 'node:process'
import { readMachineE2ELeaseSnapshot, recoverMachineE2ELease } from '../../src/lease/machineRecovery'

async function main() {
  const stateDirectory = process.argv[2]!
  const original = new Error('isolated recovery callback failed')
  try {
    await recoverMachineE2ELease({
      stateDirectory,
      env: {},
      expected: await readMachineE2ELeaseSnapshot({ stateDirectory }),
      recoverScope: async () => { throw original },
    })
    process.exitCode = 2
  }
  catch (error) {
    process.stdout.write(JSON.stringify({ originalErrorPreserved: error === original }))
    process.exitCode = error === original ? 0 : 1
  }
}

void main()
