import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 跨平台调用 Turbo 并原样传递退出状态。
import { execa } from 'execa'
import { toolchainEnvironment } from './toolchain.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const result = await execa('pnpm', ['exec', 'turbo', 'run', 'test:pure', ...process.argv.slice(2)], {
  cwd: root,
  env: await toolchainEnvironment(root),
  stdio: 'inherit',
  reject: false,
})
process.exitCode = result.exitCode ?? 1
