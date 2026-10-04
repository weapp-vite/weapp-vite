import { readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用 execa 统一处理 Windows pnpm.cmd 与子进程退出状态。
import { execa } from 'execa'

/** 跨平台选择实验绑定，串行运行真实 binding 和生产改写入口的正确性验证。 */
async function main() {
  const directory = process.argv.find(arg => arg.startsWith('--binding-dir='))?.slice('--binding-dir='.length)
  const output = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
  if (!directory || !output) {
    throw new Error('Expected --binding-dir=<feature-built directory> --output=<new report.json>')
  }
  const files = (await readdir(directory, { withFileTypes: true })).filter(file => file.isFile() && file.name.endsWith('.node'))
  if (files.length !== 1) {
    throw new Error('Expected exactly one experimental native binding')
  }
  const binding = path.resolve(directory, files[0]!.name)
  await execa('pnpm', ['--filter', '@weapp-vite/ast-native', 'exec', 'vitest', 'run', '--config', 'native.vitest.config.ts', 'test/experimentalChunkAnalysis.test.ts'], {
    env: { WEAPP_VITE_EXPERIMENTAL_CHUNK_BINDING: binding },
    stdio: 'inherit',
  })
  await execa(process.execPath, ['--import', 'tsx', 'scripts/nativeChunkAnalysis/run.ts', `--binding=${binding}`, `--output=${output}`], {
    env: { WEAPP_VITE_NATIVE: '0' },
    stdio: 'inherit',
  })
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
