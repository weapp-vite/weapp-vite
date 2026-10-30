import type { FormatConfig } from 'vite-plus/fmt'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 保留 Vite+ 子进程跨平台执行、退出码和信号处理语义。
import { execa } from 'execa'
// eslint-disable-next-line e18e/ban-dependencies -- 与文件收集共用 glob 引擎，保持 overrides、排除模式和绝对路径匹配一致。
import fg from 'fast-glob'
import { recommended } from '../index'
import { formatWxml } from '../wxml'
import { loadFormatterConfig, toFormatOptions } from './config'
import { collectWxml } from './files'

function parseArgs(args: string[]) {
  let mode: '--write' | '--check' | '--check-all' | undefined
  let configFile: string | undefined
  const inputs: string[] = []
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--write' || argument === '--check' || argument === '--check-all') {
      if (mode && mode !== argument) {
        throw new Error('只能选择一种格式检查或写入模式')
      }
      mode = argument
    }
    else if (argument === '-c' || argument === '--config') {
      configFile = args[++index]
      if (!configFile || configFile.startsWith('-')) {
        throw new Error('--config 需要配置文件路径')
      }
    }
    else if (argument.startsWith('--config=')) {
      configFile = argument.slice('--config='.length)
      if (!configFile) {
        throw new Error('--config 需要配置文件路径')
      }
    }
    else if (argument.startsWith('-')) {
      throw new Error(`未知参数：${argument}`)
    }
    else {
      inputs.push(argument)
    }
  }
  if (!mode) {
    throw new Error('请指定 --write、--check 或 --check-all')
  }
  if (mode === '--check-all' && configFile) {
    throw new Error('Vite+ check 使用工作区配置，不接受 --config')
  }
  return { mode, configFile, inputs: inputs.length ? inputs : ['.'] }
}

/** 先完整验证 WXML，再运行同一 Vite+；只有标准检查成功后才写入预先验证的 WXML。 */
export async function runFormat(args: string[], cwd = process.cwd()) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write('weapp-vite-format <--write|--check|--check-all> [-c config.json] [paths...]\n')
    return
  }
  const { mode, configFile, inputs } = parseArgs(args)
  const { config, root } = await loadFormatterConfig(cwd, configFile, mode === '--check-all')
  const scopedInputs = inputs.map((input) => {
    const negative = input.startsWith('!')
    const target = negative ? input.slice(1) : input
    const relative = path.relative(root, path.resolve(cwd, target)).split(path.sep).join('/')
    return `${negative ? '!' : ''}${relative || '.'}`
  })
  const files = await collectWxml(root, scopedInputs, [...recommended.ignorePatterns, ...(config.ignorePatterns ?? [])])
  const options = new Map<string, FormatConfig>(files.map(file => [file, toFormatOptions(config)]))
  for (const override of config.overrides ?? []) {
    const matches = await fg(override.files, { cwd: root, absolute: true, onlyFiles: true, ignore: override.excludeFiles ?? [] })
    for (const file of matches) {
      if (options.has(file)) {
        options.set(file, { ...options.get(file), ...override.options })
      }
    }
  }
  const changes: Array<{ file: string, source: string, formatted: string }> = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const formatted = await formatWxml(source, path.relative(cwd, file), options.get(file))
    if (formatted !== source) {
      changes.push({ file, source, formatted })
    }
  }
  const vp = (() => {
    try {
      return fileURLToPath(new URL('../bin/vp', import.meta.resolve('vite-plus')))
    }
    catch (cause) {
      throw new Error('weapp-vite-format 需要项目安装 Vite+ >=1.2.0。', { cause })
    }
  })()
  const vpArgs = mode === '--check-all'
    ? ['check', ...inputs]
    : ['fmt', mode, ...(configFile ? ['-c', configFile] : []), ...inputs, '!**/*.wxml']
  const result = await execa(process.execPath, [vp, ...vpArgs], { cwd, stdio: 'inherit', reject: false })
  if (mode !== '--write') {
    for (const change of changes) {
      process.stderr.write(`WXML 需要格式化：${path.relative(cwd, change.file).split(path.sep).join('/')}\n`)
    }
    if (result.exitCode !== 0 || changes.length > 0) {
      process.exitCode = result.exitCode || 1
    }
    return
  }
  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode || 1
    return
  }
  for (const change of changes) {
    if (await readFile(change.file, 'utf8') !== change.source) {
      throw new Error('格式化期间 WXML 文件发生变化，拒绝覆盖')
    }
  }
  for (const change of changes) {
    await writeFile(change.file, change.formatted)
  }
}
