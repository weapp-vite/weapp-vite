/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { cac } from 'cac'
import ci from 'miniprogram-ci'

const QRCODE_FORMATS = new Set(['terminal', 'image', 'base64'])

function ensureStringOption(value, optionName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`缺少 --${optionName}`)
  }
  return value.trim()
}

function ensureNumberOption(value, optionName, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`参数 ${optionName} 需要是数字，当前值为 ${String(value)}`)
  }
  return parsed
}

async function runAction(action, options) {
  const projectRoot = path.resolve(ensureStringOption(options.projectRoot, 'project-root'))
  const privateKeyPath = path.resolve(ensureStringOption(options.privateKey, 'private-key'))
  const appid = ensureStringOption(options.appid, 'appid')
  const projectType = ensureStringOption(options.projectType, 'project-type')
  const version = ensureStringOption(options.ciVersion, 'ci-version')
  const desc = ensureStringOption(options.desc, 'desc')
  const robot = ensureNumberOption(options.robot, 'robot', 1)
  const qrcodeFormat = typeof options.qrcodeFormat === 'string' ? options.qrcodeFormat : 'image'
  const qrcodeOutputDest = typeof options.qrcodeOutput === 'string' ? options.qrcodeOutput : undefined
  const sourceMapSavePath = typeof options.sourceMapSavePath === 'string' ? options.sourceMapSavePath : undefined
  const pagePath = typeof options.page === 'string' ? options.page : undefined
  const searchQuery = typeof options.query === 'string' ? options.query : undefined
  const scene = ensureNumberOption(options.scene, 'scene', undefined)

  if (!QRCODE_FORMATS.has(qrcodeFormat)) {
    throw new Error(`不支持的 qrcode format: ${qrcodeFormat}，仅支持 terminal、image、base64`)
  }

  await fs.access(projectRoot)
  await fs.access(privateKeyPath)

  const project = new ci.Project({
    appid,
    type: projectType,
    projectPath: projectRoot,
    privateKeyPath,
  })

  const sharedOptions = {
    project,
    desc,
    robot,
    setting: {
      useProjectConfig: true,
    },
    onProgressUpdate(message) {
      console.log('[miniprogram-ci:progress]', message)
    },
  }

  if (action === 'preview') {
    if (qrcodeOutputDest) {
      await fs.mkdir(path.dirname(qrcodeOutputDest), { recursive: true })
    }

    await ci.preview({
      ...sharedOptions,
      version,
      qrcodeFormat,
      qrcodeOutputDest,
      pagePath,
      searchQuery,
      scene,
      sourceMapSavePath,
    })
    console.log('[miniprogram-ci] preview complete')
    if (qrcodeOutputDest) {
      console.log(`[miniprogram-ci] qrcode=${qrcodeOutputDest}`)
    }
    return
  }

  await ci.upload({
    ...sharedOptions,
    version,
  })
  console.log('[miniprogram-ci] upload complete')
}

const cli = cac('miniprogram-ci-runner')

function registerCommand(action, description) {
  cli
    .command(action, description)
    .option('--project-root <path>', '目标项目根目录')
    .option('--private-key <path>', '代码上传密钥路径')
    .option('--appid <appid>', '小程序 AppID')
    .option('--project-type <type>', '项目类型，例如 miniProgram')
    .option('--ci-version <version>', '版本号')
    .option('--desc <desc>', '版本描述')
    .option('--robot <number>', 'CI 机器人编号', { default: '1' })
    .option('--page <path>', '预览页面路径')
    .option('--query <text>', '预览 query')
    .option('--scene <number>', '预览 scene')
    .option('--qrcode-format <format>', '二维码格式 terminal/image/base64', { default: 'image' })
    .option('--qrcode-output <path>', '二维码输出路径')
    .option('--source-map-save-path <path>', 'sourcemap 输出路径')
    .action(async options => runAction(action, options))
}

registerCommand('preview', '执行 miniprogram-ci preview')
registerCommand('upload', '执行 miniprogram-ci upload')

cli.help()

async function main() {
  cli.parse(process.argv, { run: false })
  await cli.runMatchedCommand()
}

main().catch((error) => {
  console.error(`[miniprogram-ci] ${error.message}`)
  process.exitCode = 1
})
