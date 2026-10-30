import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { loadProjectConfig } from '@weapp-vite/language-service/project'
// eslint-disable-next-line e18e/ban-dependencies -- 保留 Windows 命令解析、信号和退出码语义。
import { execa } from 'execa'
import { recommended } from '../index'
import { parseArgs } from './args'
import { prepareFormatting } from './prepare'
import { commitFormatting } from './transaction'

async function checkProject(cwd: string, inputs: string[]) {
  const vp = fileURLToPath(new URL('../bin/vp', import.meta.resolve('vite-plus')))
  const result = await execa(process.execPath, [vp, 'check', ...inputs], { cwd, stdio: 'inherit', reject: false })
  let exitCode = result.exitCode ?? 1
  const manifest = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
  for (const script of ['lint:vue', 'stylelint']) {
    if (manifest.scripts?.[script]) {
      const checked = await execa('npm', ['run', script], { cwd, stdio: 'inherit', reject: false })
      exitCode ||= checked.exitCode ?? 1
    }
  }
  return exitCode
}

/** 一次预检全部候选文件；读取后发生源码变化时拒绝覆盖，检查模式不写入。 */
export async function runFormat(args: string[], cwd = process.cwd()) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write('weapp-vite-format <--write|--check|--check-all> [-c config.json] [paths...]\n')
    return
  }
  const { mode, configFile, inputs } = parseArgs(args)
  const project = await loadProjectConfig(cwd, { configFile, workspaceFirst: mode === '--check-all' })
  const scopedInputs = inputs.map((input) => {
    const negative = input.startsWith('!')
    const target = negative ? input.slice(1) : input
    const relative = path.relative(project.root, path.resolve(cwd, target)).split(path.sep).join('/')
    return `${negative ? '!' : ''}${relative || '.'}`
  })
  const candidates = await prepareFormatting(project.root, scopedInputs, project.fmt ?? recommended, project.language)
  const changes = candidates.filter(candidate => candidate.source !== candidate.formatted)
  if (mode !== '--write') {
    for (const change of changes) {
      const label = path.relative(cwd, change.file).split(path.sep).join('/')
      process.stderr.write(`${change.file.endsWith('.wxml') ? 'WXML' : '文件'} 需要格式化：${label}\n`)
    }
    const exitCode = mode === '--check-all' ? await checkProject(cwd, inputs) : 0
    if (exitCode !== 0 || changes.length > 0) {
      process.exitCode = exitCode || 1
    }
    return
  }
  await commitFormatting(candidates)
}
