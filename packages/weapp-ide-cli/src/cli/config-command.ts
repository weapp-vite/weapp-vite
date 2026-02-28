import fs from 'fs-extra'
import { createCustomConfig, createLocaleConfig, overwriteCustomConfig, readCustomConfig, removeCustomConfigKey } from '../config/custom'
import { defaultCustomConfigFilePath } from '../config/paths'
import { i18nText } from '../i18n'
import logger, { colors } from '../logger'
import { promptForCliPath } from './prompt'
import { resolveCliPath } from './resolver'

/**
 * @description 处理 config 子命令。
 */
export async function handleConfigCommand(argv: string[]) {
  const action = argv[0]

  if (!action) {
    await promptForCliPath()
    return
  }

  if (action === 'lang' || action === 'set-lang') {
    const nextLocale = argv[1]
    if (nextLocale !== 'zh' && nextLocale !== 'en') {
      throw new Error(i18nText(
        '请使用 weapp config lang <zh|en> 切换语言',
        'Use weapp config lang <zh|en> to switch language',
      ))
    }

    await createLocaleConfig(nextLocale)
    logger.info(i18nText(
      `语言已切换为：${nextLocale === 'zh' ? '中文' : '英文'}`,
      `Language switched to: ${nextLocale}`,
    ))
    return
  }

  if (action === 'show') {
    const config = await readCustomConfig()
    logger.info(i18nText(
      `配置文件路径：${colors.green(defaultCustomConfigFilePath)}`,
      `Config file: ${colors.green(defaultCustomConfigFilePath)}`,
    ))
    console.log(JSON.stringify(config, null, 2))
    return
  }

  if (action === 'get') {
    const key = argv[1]
    if (key !== 'cliPath' && key !== 'locale') {
      throw new Error(i18nText(
        '仅支持读取配置项：cliPath | locale',
        'Supported keys: cliPath | locale',
      ))
    }

    const config = await readCustomConfig()
    const value = config[key]
    if (typeof value === 'string') {
      console.log(value)
      return
    }

    console.log('')
    return
  }

  if (action === 'set') {
    const key = argv[1]
    const value = argv.slice(2).join(' ').trim()

    if (!value) {
      throw new Error(i18nText(
        '请提供配置值，例如：weapp config set locale en',
        'Please provide a value, e.g. weapp config set locale en',
      ))
    }

    if (key === 'cliPath') {
      await createCustomConfig({ cliPath: value })
      logger.info(i18nText('CLI 路径已更新。', 'CLI path updated.'))
      return
    }

    if (key === 'locale') {
      if (value !== 'zh' && value !== 'en') {
        throw new Error(i18nText(
          'locale 仅支持 zh 或 en',
          'locale only supports zh or en',
        ))
      }
      await createLocaleConfig(value)
      logger.info(i18nText(
        `语言已切换为：${value === 'zh' ? '中文' : '英文'}`,
        `Language switched to: ${value}`,
      ))
      return
    }

    throw new Error(i18nText(
      '仅支持设置配置项：cliPath | locale',
      'Supported keys for set: cliPath | locale',
    ))
  }

  if (action === 'unset') {
    const key = argv[1]
    if (key !== 'cliPath' && key !== 'locale') {
      throw new Error(i18nText(
        '仅支持清除配置项：cliPath | locale',
        'Supported keys for unset: cliPath | locale',
      ))
    }

    await removeCustomConfigKey(key)
    logger.info(i18nText(
      `已清除配置项：${key}`,
      `Config key cleared: ${key}`,
    ))
    return
  }

  if (action === 'doctor') {
    const rawConfig = await readCustomConfig()
    const hasConfigFile = await fs.pathExists(defaultCustomConfigFilePath)
    const resolvedCli = await resolveCliPath()
    const hasCustomCli = typeof rawConfig.cliPath === 'string' && rawConfig.cliPath.length > 0
    const hasValidCli = Boolean(resolvedCli.cliPath)
    const locale = rawConfig.locale ?? 'zh'

    const report = {
      configFile: defaultCustomConfigFilePath,
      configFileExists: hasConfigFile,
      cliPath: rawConfig.cliPath ?? null,
      cliPathValid: hasValidCli,
      locale,
      source: resolvedCli.source,
    }

    logger.info(i18nText('配置诊断结果：', 'Configuration diagnostics:'))
    console.log(JSON.stringify(report, null, 2))

    if (!hasConfigFile) {
      logger.warn(i18nText(
        '未找到配置文件，可执行 weapp config 进行初始化。',
        'Config file not found. Run `weapp config` to initialize.',
      ))
    }
    if (hasCustomCli && !hasValidCli) {
      logger.warn(i18nText(
        '检测到配置的 cliPath 不可用，请执行 weapp config set cliPath <path> 修复。',
        'Configured cliPath is not available. Run `weapp config set cliPath <path>` to fix it.',
      ))
    }

    return
  }

  if (action === 'export') {
    const outputPath = argv[1]
    const config = await readCustomConfig()

    if (outputPath) {
      await fs.writeJSON(outputPath, config, { spaces: 2, encoding: 'utf8' })
      logger.info(i18nText(
        `配置已导出到：${colors.green(outputPath)}`,
        `Config exported to: ${colors.green(outputPath)}`,
      ))
      return
    }

    console.log(JSON.stringify(config, null, 2))
    return
  }

  if (action === 'import') {
    const inputPath = argv[1]
    if (!inputPath) {
      throw new Error(i18nText(
        '请提供导入文件路径，例如：weapp config import ./weapp-config.json',
        'Please provide import file path, e.g. weapp config import ./weapp-config.json',
      ))
    }

    const imported = await fs.readJSON(inputPath)
    if (!imported || typeof imported !== 'object') {
      throw new Error(i18nText(
        '导入文件格式无效：应为 JSON 对象',
        'Invalid import file format: expected a JSON object',
      ))
    }

    const candidate = imported as { cliPath?: unknown, locale?: unknown }
    const cliPath = typeof candidate.cliPath === 'string' ? candidate.cliPath : undefined
    const locale = candidate.locale === 'zh' || candidate.locale === 'en' ? candidate.locale : undefined

    await overwriteCustomConfig({ cliPath, locale })
    logger.info(i18nText(
      `配置已从 ${colors.green(inputPath)} 导入`,
      `Config imported from ${colors.green(inputPath)}`,
    ))
    return
  }

  throw new Error(i18nText(
    '支持的 config 子命令：lang | set-lang | show | get | set | unset | doctor | import | export',
    'Supported config subcommands: lang | set-lang | show | get | set | unset | doctor | import | export',
  ))
}
