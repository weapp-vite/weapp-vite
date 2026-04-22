import { readBooleanOption, readOptionValue } from './automator-argv'
import { runWechatIdeEngineBuild } from './engine'
import {
  autoPreviewWechatIde,
  autoReplayWechatIde,
  autoWechatIde,
  buildWechatIdeApk,
  buildWechatIdeIpa,
  buildWechatIdeNpm,
  clearWechatIdeCache,
  closeWechatIdeProject,
  isWechatIdeLoggedIn,
  loginWechatIde,
  openWechatIde,
  openWechatIdeOtherProject,
  previewWechatIde,
  quitWechatIde,
  resetWechatIdeFileUtils,
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
      qrFormat: readOptionValue(argv, '--qr-format', '-f') as 'base64' | 'image' | 'terminal' | undefined,
      qrOutput: readOptionValue(argv, '--qr-output', '-o'),
      qrSize: readOptionValue(argv, '--qr-size'),
      resultOutput: readOptionValue(argv, '--result-output', '-r'),
    })
    return true
  }

  if (command === 'open') {
    await openWechatIde({
      appid: readOptionValue(argv, '--appid'),
      extAppid: readOptionValue(argv, '--ext-appid'),
      platform: readOptionValue(argv, '--platform'),
      projectPath: readOptionValue(argv, '--project', '-p'),
      trustProject: hasOption(argv, '--trust-project'),
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
      infoOutput: readOptionValue(argv, '--info-output', '-i'),
      projectPath: readOptionValue(argv, '--project', '-p'),
      qrFormat: readOptionValue(argv, '--qr-format', '-f') as 'base64' | 'image' | 'terminal' | undefined,
      qrOutput: readOptionValue(argv, '--qr-output', '-o'),
      qrSize: readOptionValue(argv, '--qr-size'),
    })
    return true
  }

  if (command === 'auto-preview') {
    await autoPreviewWechatIde({
      appid: readOptionValue(argv, '--appid'),
      compileCondition: readOptionValue(argv, '--compile-condition'),
      extAppid: readOptionValue(argv, '--ext-appid'),
      infoOutput: readOptionValue(argv, '--info-output', '-i'),
      projectPath: readOptionValue(argv, '--project', '-p'),
    })
    return true
  }

  if (command === 'auto') {
    await autoWechatIde({
      account: readOptionValue(argv, '--auto-account'),
      appid: readOptionValue(argv, '--appid'),
      extAppid: readOptionValue(argv, '--ext-appid'),
      port: readOptionValue(argv, '--auto-port'),
      projectPath: readOptionValue(argv, '--project', '-p'),
      testTicket: readOptionValue(argv, '--test-ticket'),
      ticket: readOptionValue(argv, '--ticket'),
      trustProject: hasOption(argv, '--trust-project'),
    })
    return true
  }

  if (command === 'auto-replay') {
    await autoReplayWechatIde({
      account: readOptionValue(argv, '--auto-account'),
      appid: readOptionValue(argv, '--appid'),
      extAppid: readOptionValue(argv, '--ext-appid'),
      port: readOptionValue(argv, '--auto-port'),
      projectPath: readOptionValue(argv, '--project', '-p'),
      replayAll: hasOption(argv, '--replay-all'),
      replayConfigPath: readOptionValue(argv, '--replay-config-path'),
      testTicket: readOptionValue(argv, '--test-ticket'),
      ticket: readOptionValue(argv, '--ticket'),
      trustProject: hasOption(argv, '--trust-project'),
    })
    return true
  }

  if (command === 'upload') {
    const version = readOptionValue(argv, '--version', '-v')
    const desc = readOptionValue(argv, '--desc', '-d')
    if (!version || !desc) {
      return false
    }

    await uploadWechatIde({
      appid: readOptionValue(argv, '--appid'),
      desc,
      extAppid: readOptionValue(argv, '--ext-appid'),
      infoOutput: readOptionValue(argv, '--info-output', '-i'),
      projectPath: readOptionValue(argv, '--project', '-p'),
      version,
    })
    return true
  }

  if (command === 'build-apk') {
    const output = readOptionValue(argv, '--output', '-o')
    const keyStore = readOptionValue(argv, '--key-store', '--keyStore', '-ks')
    const keyAlias = readOptionValue(argv, '--key-alias', '--keyAlias', '-ka')
    const keyPass = readOptionValue(argv, '--key-pass', '--keyPass', '-kp')
    const storePass = readOptionValue(argv, '--store-pass', '--storePass', '-sp')
    if (!output || !keyStore || !keyAlias || !keyPass || !storePass) {
      return false
    }

    await buildWechatIdeApk({
      desc: readOptionValue(argv, '--desc', '-d'),
      isUploadResourceBundle: hasOption(argv, '--isUploadResourceBundle'),
      keyAlias,
      keyPass,
      keyStore,
      output,
      resourceBundleDesc: readOptionValue(argv, '--resourceBundleDesc'),
      resourceBundleVersion: readOptionValue(argv, '--resourceBundleVersion'),
      storePass,
      useAab: readBooleanOption(argv, '--use-aab', '--useAab', '-u'),
    })
    return true
  }

  if (command === 'build-ipa') {
    const output = readOptionValue(argv, '--output', '-o')
    const isDistribute = readBooleanOption(argv, '--isDistribute')
    if (!output || isDistribute === undefined) {
      return false
    }

    await buildWechatIdeIpa({
      certificateName: readOptionValue(argv, '--certificateName'),
      isDistribute,
      isRemoteBuild: readBooleanOption(argv, '--isRemoteBuild') ?? false,
      isUploadBeta: readBooleanOption(argv, '--isUploadBeta') ?? false,
      isUploadResourceBundle: hasOption(argv, '--isUploadResourceBundle'),
      output,
      p12Password: readOptionValue(argv, '--p12Password'),
      p12Path: readOptionValue(argv, '--p12Path'),
      profilePath: readOptionValue(argv, '--profilePath'),
      resourceBundleDesc: readOptionValue(argv, '--resourceBundleDesc'),
      resourceBundleVersion: readOptionValue(argv, '--resourceBundleVersion'),
      tpnsProfilePath: readOptionValue(argv, '--tpnsProfilePath'),
      versionCode: readOptionValue(argv, '--versionCode')
        ? Number(readOptionValue(argv, '--versionCode'))
        : undefined,
      versionDesc: readOptionValue(argv, '--versionDesc'),
      versionName: readOptionValue(argv, '--versionName'),
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
    const clean = readOptionValue(argv, '--clean', '-c')
    if (!clean) {
      return false
    }

    await clearWechatIdeCache({
      clean: clean as 'all' | 'auth' | 'compile' | 'file' | 'network' | 'session' | 'storage',
    })
    return true
  }

  if (command === 'open-other' && !hasOption(argv, '--project') && !hasOption(argv, '-p')) {
    await openWechatIdeOtherProject()
    return true
  }

  if (command === 'reset-fileutils') {
    const projectPath = readOptionValue(argv, '--project', '-p')
    if (!projectPath) {
      return false
    }

    await resetWechatIdeFileUtils({ projectPath })
    return true
  }

  if (command === 'engine' && argv[1] === 'build') {
    const projectPath = argv[2]
    if (!projectPath) {
      return false
    }

    await runWechatIdeEngineBuild(projectPath, {
      logPath: readOptionValue(argv, '--logPath', '-l'),
    })
    return true
  }

  return false
}
