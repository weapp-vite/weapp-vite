import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 沿用正式 CLI 且收集安装期容错输出，验证阶段不得把跳过当作成功。
import { execa } from 'execa'

interface PrepareResult { exitCode?: number, stdout?: string, stderr?: string }
type PrepareExecutor = (command: string, args: string[], options: { cwd: string, reject: false }) => Promise<PrepareResult>

async function consumerPrepareArgs(cwd: string): Promise<string[]> {
  const manifest = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> }
  const script = manifest.scripts?.postinstall
  if (typeof script !== 'string' || !/^(?:wv|weapp-vite)[ \t]+prepare(?:[ \t]|$)/.test(script)) {
    return []
  }
  // 只继承消费者已声明的目标，不执行安装脚本或覆盖配置中的默认平台。
  const prepared = /^(?:wv|weapp-vite)[ \t]+prepare(?:[ \t]+(?:-p[ \t]+|--platform(?:[ \t]+|=))(weapp|alipay|tt|swan|jd|xhs|web))?[ \t]*$/.exec(script)
  assert(prepared, '消费者 postinstall prepare 参数无法安全复用，请提供显式平台契约')
  return prepared[1] ? ['--platform', prepared[1]] : []
}

/** 只调用正式 prepare 生成支持文件，拒绝 CLI 安装期容错返回的假成功。 */
export async function prepareConsumerSupport(root: string, directory: string, cli: string, execute: PrepareExecutor = execa): Promise<void> {
  const cwd = path.resolve(root, directory)
  assert(cwd.startsWith(`${path.resolve(root)}${path.sep}`), '消费者目录必须位于候选工作区内')
  const args = await consumerPrepareArgs(cwd)
  const result = await execute(process.execPath, [path.resolve(root, cli), 'prepare', ...args], { cwd, reject: false })
  if (result.stdout) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }
  assert.equal(result.exitCode, 0, '消费者 prepare 命令未通过')
  assert(!`${result.stdout ?? ''}\n${result.stderr ?? ''}`.includes('跳过 .weapp-vite 支持文件预生成'), '消费者 prepare 跳过生成，不能执行类型检查')
  const config: unknown = JSON.parse(await readFile(path.join(cwd, '.weapp-vite/tsconfig.app.json'), 'utf8'))
  assert(config && typeof config === 'object' && !Array.isArray(config), '消费者 prepare 未生成有效的应用类型配置')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { directory: { type: 'string' }, cli: { type: 'string' } } })
  assert(values.directory && values.cli, '消费者 prepare 缺少冻结的目录或 CLI')
  await prepareConsumerSupport(process.cwd(), values.directory, values.cli)
}
