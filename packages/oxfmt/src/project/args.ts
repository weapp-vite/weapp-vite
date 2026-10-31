/** CLI 参数只描述检查对象和模式，不能静默接受未实现的开关。 */
export function parseArgs(args: string[]) {
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
