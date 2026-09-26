import { spawnSync } from 'node:child_process'
import process from 'node:process'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = spawnSync(pnpm, ['e2e:dom-acceptance:write'], {
  cwd: process.cwd(),
  stdio: 'inherit',
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const add = spawnSync('git', [
  'add',
  'e2e/dom-acceptance-inventory.json',
  'e2e/dom-acceptance-inventory.md',
], {
  cwd: process.cwd(),
  stdio: 'inherit',
})

process.exit(add.status ?? 1)
