import { spawn } from 'node:child_process'
import process from 'node:process'

const child = spawn(process.platform === 'win32' ? 'wv.cmd' : 'wv', ['analyze', '--budget-check'], {
  env: {
    ...process.env,
    WEAPP_VITE_DASHBOARD_LAB_LOW_BUDGET: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''

child.stdout.on('data', (chunk) => {
  output += chunk.toString()
})

child.stderr.on('data', (chunk) => {
  output += chunk.toString()
})

child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})

child.on('close', (code) => {
  process.stdout.write(output)
  if (code === 0) {
    process.stderr.write('expected low-budget analyze check to fail, but it passed\n')
    process.exitCode = 1
    return
  }
  if (!output.includes('包体预算检查失败')) {
    process.stderr.write('expected budget failure output to include 包体预算检查失败\n')
    process.exitCode = 1
  }
})
