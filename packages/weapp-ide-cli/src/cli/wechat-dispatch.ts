import { readOptionValue } from './automator-argv'
import {
  autoPreviewWechatIde,
  buildWechatIdeNpm,
  clearWechatIdeCache,
  closeWechatIdeProject,
  isWechatIdeLoggedIn,
  loginWechatIde,
  openWechatIdeOtherProject,
  previewWechatIde,
  quitWechatIde,
  uploadWechatIde,
} from './wechat-commands'

function hasOption(argv: readonly string[], optionName: string) {
  return argv.includes(optionName) || argv.some(token => token.startsWith(`${optionName}=`))
}

/**
 * @description 优先将高频官方命令分发到 weapp-ide-cli 的稳定 helper，实现更清晰的程序化命令层。
 */
export async function dispatchWechatCliCommand(argv: string[]) {
  const command = argv[0]
  if (!command) {
    return false
  }

  if (command === 'login') {
    await loginWechatIde({
      qrFormat: readOptionValue(argv, '--qr-format') as 'base64' | 'image' | 'terminal' | undefined,
      qrOutput: readOptionValue(argv, '--qr-output'),
      qrSize: readOptionValue(argv, '--qr-size'),
      resultOutput: readOptionValue(argv, '--result-output'),
    })
    return true
  }

  if (command === 'islogin') {
    await isWechatIdeLoggedIn()
    return true
  }

  if (command === 'build-npm') {
    await buildWechatIdeNpm({
      compileType: readOptionValue(argv, '--compile-type'),
      projectPath: readOptionValue(argv, '--project'),
    })
    return true
  }

  if (command === 'preview') {
    await previewWechatIde({
      appid: readOptionValue(argv, '--appid'),
      compileCondition: readOptionValue(argv, '--compile-condition'),
      extAppid: readOptionValue(argv, '--ext-appid'),
      infoOutput: readOptionValue(argv, '--info-output'),
      projectPath: readOptionValue(argv, '--project'),
      qrFormat: readOptionValue(argv, '--qr-format') as 'base64' | 'image' | 'terminal' | undefined,
      qrOutput: readOptionValue(argv, '--qr-output'),
      qrSize: readOptionValue(argv, '--qr-size'),
    })
    return true
  }

  if (command === 'auto-preview') {
    await autoPreviewWechatIde({
      appid: readOptionValue(argv, '--appid'),
      compileCondition: readOptionValue(argv, '--compile-condition'),
      extAppid: readOptionValue(argv, '--ext-appid'),
      infoOutput: readOptionValue(argv, '--info-output'),
      projectPath: readOptionValue(argv, '--project'),
    })
    return true
  }

  if (command === 'upload') {
    const version = readOptionValue(argv, '--version')
    const desc = readOptionValue(argv, '--desc')
    if (!version || !desc) {
      return false
    }

    await uploadWechatIde({
      appid: readOptionValue(argv, '--appid'),
      desc,
      extAppid: readOptionValue(argv, '--ext-appid'),
      infoOutput: readOptionValue(argv, '--info-output'),
      projectPath: readOptionValue(argv, '--project'),
      version,
    })
    return true
  }

  if (command === 'close') {
    await closeWechatIdeProject()
    return true
  }

  if (command === 'quit') {
    await quitWechatIde()
    return true
  }

  if (command === 'cache') {
    const clean = readOptionValue(argv, '--clean')
    if (!clean) {
      return false
    }

    await clearWechatIdeCache({
      clean: clean as 'all' | 'auth' | 'compile' | 'file' | 'network' | 'session' | 'storage',
    })
    return true
  }

  if (command === 'open-other' && !hasOption(argv, '--project')) {
    await openWechatIdeOtherProject()
    return true
  }

  return false
}
