import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用 execa 统一解析 Windows pnpm.cmd 并转发子进程错误。
import { execa } from 'execa'

/** 独立进程执行绑定测试、真实编译捕获和批量重放，不在 CI 采样性能。 */
async function main() {
  const argument = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const directory = argument('binding-dir')
  const output = argument('output-dir')
  if (!directory || !output) {
    throw new Error('Expected --binding-dir=<feature-built directory> --output-dir=<new directory>')
  }
  const files = (await readdir(directory, { withFileTypes: true })).filter(file => file.isFile() && file.name.endsWith('.node'))
  if (files.length !== 1) {
    throw new Error('Expected exactly one experimental binding')
  }
  await mkdir(output)
  const binding = path.resolve(directory, files[0]!.name)
  await execa('pnpm', ['--filter', '@weapp-vite/ast-native', 'exec', 'vitest', 'run', '--config', 'native.vitest.config.ts', 'test/experimentalBindingAnalysis.test.ts'], {
    env: { WEAPP_VITE_EXPERIMENTAL_BINDING_BINDING: binding, WEAPP_VITE_NATIVE: '0' },
    stdio: 'inherit',
  })
  const capture = path.join(output, 'capture.json')
  for (const args of [
    ['scripts/nativeBindingAnalysis/capture.ts', `--output=${capture}`],
    ['scripts/nativeBindingAnalysis/run.ts', `--input=${capture}`, `--binding=${binding}`, `--output=${path.join(output, 'correctness.json')}`],
    ['scripts/nativeBindingAnalysis/compile.ts', `--binding=${binding}`, `--output=${path.join(output, 'complete-compiler')}`],
  ]) {
    await execa(process.execPath, ['--import', 'tsx', ...args], { env: { WEAPP_VITE_NATIVE: '0' }, stdio: 'inherit' })
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
