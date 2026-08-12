/* eslint-disable e18e/ban-dependencies -- 官方 minidev smoke 需要 execa 驱动独立 CLI。 */
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'

interface MinidevBuildResult {
  project?: string
  result?: {
    compileType?: string
    components?: string[]
    outPath?: string
  }
}

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const PROJECT_ROOT = path.join(REPO_ROOT, 'apps/alipay-antd-mini-demo')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const TEMP_ROOT = path.join(REPO_ROOT, '.tmp')

function parseMachineOutput(stdout: string) {
  const lines = stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const jsonLine = lines.findLast(line => line.startsWith('{') && line.endsWith('}'))
  if (!jsonLine) {
    throw new Error('minidev 未返回可解析的 machine output。')
  }
  return JSON.parse(jsonLine) as MinidevBuildResult
}

async function main() {
  await execa('node', [CLI_PATH, 'build', PROJECT_ROOT, '--platform', 'alipay'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })

  await fs.ensureDir(TEMP_ROOT)
  const outputRoot = await fs.mkdtemp(path.join(TEMP_ROOT, 'alipay-minidev-'))
  try {
    const result = await execa('minidev', [
      'build',
      '--project',
      PROJECT_ROOT,
      '--output',
      outputRoot,
      '--machine-output',
    ], {
      cwd: REPO_ROOT,
      preferLocal: true,
      reject: false,
    })

    if (result.exitCode !== 0) {
      const detail = result.stderr.trim()
        || result.stdout.trim()
        || result.shortMessage
        || (result.signal ? `signal ${result.signal}` : `exit code ${result.exitCode ?? 'unknown'}`)
      throw new Error(`minidev 编译支付宝示例失败：${detail}`)
    }

    const output = parseMachineOutput(result.stdout)
    if (output.result?.compileType !== 'mini') {
      throw new Error(`minidev 返回了非小程序编译结果：${output.result?.compileType ?? 'unknown'}`)
    }
    if (!output.result.components?.includes('ant-button')) {
      throw new Error('minidev 编译结果未识别 antd-mini 的 ant-button 组件。')
    }

    process.stdout.write('[alipay-minidev-smoke] passed: native + Vue SFC + SJS + antd-mini\n')
  }
  finally {
    await fs.remove(outputRoot)
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[alipay-minidev-smoke] failed: ${detail}\n`)
  process.exitCode = 1
})
