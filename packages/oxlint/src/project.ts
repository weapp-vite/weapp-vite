import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { analyzeProject, loadProjectConfig, printDiagnostic } from '@weapp-vite/language-service/project'
// eslint-disable-next-line e18e/ban-dependencies -- Oxlint 组合入口保留跨平台命令解析与信号处理。
import { execa } from 'execa'

/** 原生语言分析与标准 Oxlint 分别处理所属文件，避免未知后缀被静默跳过。 */
export async function runLint(args: string[], cwd = process.cwd()) {
  const inputs: string[] = []
  const flags: string[] = []
  let nativeOnly = false
  let configFile: string | undefined
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--native-only') {
      nativeOnly = true
    }
    else if (argument === '--fix' || argument === '--deny-warnings') {
      flags.push(argument)
    }
    else if (argument === '-c' || argument === '--config') {
      configFile = args[++index]
      if (!configFile || configFile.startsWith('-')) {
        throw new Error('--config 需要配置文件路径')
      }
      flags.push(argument, configFile)
    }
    else if (argument === '-h' || argument === '--help') {
      process.stdout.write('weapp-vite-lint [--fix] [--deny-warnings] [--native-only] [-c config] [paths...]\n')
      return
    }
    else if (argument.startsWith('-')) {
      throw new Error(`未知参数：${argument}`)
    }
    else {
      inputs.push(argument)
    }
  }
  const project = await loadProjectConfig(cwd, { configFile, configKind: 'lint' })
  const paths = inputs.length ? inputs : ['.']
  const scopedInputs = paths.map((input) => {
    const negative = input.startsWith('!')
    const relative = path.relative(project.root, path.resolve(cwd, negative ? input.slice(1) : input)).split(path.sep).join('/')
    return `${negative ? '!' : ''}${relative || '.'}`
  })
  const documents = await analyzeProject(project.root, scopedInputs, project.language, project.lint?.ignorePatterns)
  let failed = false
  for (const document of documents) {
    for (const diagnostic of document.analysis.diagnostics) {
      process.stderr.write(`${printDiagnostic(document.fileName, document.source, diagnostic)}\n`)
      failed ||= diagnostic.severity === 'error' || (diagnostic.severity === 'warning' && flags.includes('--deny-warnings'))
    }
  }
  if (!nativeOnly) {
    const vp = fileURLToPath(new URL('../bin/vp', import.meta.resolve('vite-plus')))
    const result = await execa(process.execPath, [vp, 'lint', ...flags, ...paths], { cwd, stdio: 'inherit', reject: false })
    failed ||= result.exitCode !== 0
  }
  if (failed) {
    process.exitCode = 1
  }
}
