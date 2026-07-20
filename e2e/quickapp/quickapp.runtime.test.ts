/* eslint-disable e18e/ban-dependencies -- QuickApp runtime E2E 需要驱动 CLI、hap-toolkit 与 ADB。 */
import type { ResultPromise } from 'execa'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import { XMLParser } from 'fast-xml-parser'
import path from 'pathe'
import { afterAll, beforeAll, describe, it } from 'vitest'

interface UiNode {
  bounds?: string
  text?: string
}

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.join(ROOT, 'e2e-apps/quickapp-runtime-e2e')
const OUTPUT_ROOT = path.join(APP_ROOT, 'dist/quickapp')
const QUICKAPP_PACKAGE = 'org.weappvite.quickapp.e2e'
const REQUIRED_HOST_PACKAGES = ['org.hapjs.mockup', 'org.hapjs.debugger']
const UI_DUMP_PATH = '/sdcard/weapp-vite-quickapp-e2e.xml'
const parser = new XMLParser({
  attributeNamePrefix: '',
  ignoreAttributes: false,
  parseAttributeValue: false,
})

let adbSerial = ''
let runAppLog = ''
let runAppProcess: ResultPromise | undefined
let skippedWifiPrompt = false

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function resolveAdbCommand() {
  if (process.env.WEAPP_VITE_QUICKAPP_ADB) {
    return process.env.WEAPP_VITE_QUICKAPP_ADB
  }
  if (process.env.ANDROID_HOME) {
    return path.join(process.env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
  }
  return 'adb'
}

function resolveHapCommand() {
  return path.join(ROOT, 'node_modules/.bin', process.platform === 'win32' ? 'hap.cmd' : 'hap')
}

async function adb(args: string[], options: { serial?: boolean } = { serial: true }) {
  const serialArgs = options.serial !== false && adbSerial ? ['-s', adbSerial] : []
  return await execa(resolveAdbCommand(), [...serialArgs, ...args])
}

async function resolveDeviceSerial() {
  const { stdout } = await adb(['devices'], { serial: false })
  const devices = stdout
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts[0] && parts[1] === 'device')
    .map(parts => parts[0])
  const requested = process.env.WEAPP_VITE_QUICKAPP_DEVICE
  if (requested) {
    if (!devices.includes(requested)) {
      throw new Error(`未找到 WEAPP_VITE_QUICKAPP_DEVICE 指定的设备：${requested}`)
    }
    return requested
  }
  if (devices.length !== 1) {
    throw new Error(`QuickApp E2E 需要且只允许一个在线 ADB 设备，当前数量：${devices.length}`)
  }
  return devices[0]
}

function collectUiNodes(value: unknown, result: UiNode[] = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectUiNodes(item, result))
    return result
  }
  if (!value || typeof value !== 'object') {
    return result
  }
  const record = value as Record<string, unknown>
  if (typeof record.text === 'string' || typeof record.bounds === 'string') {
    result.push({
      bounds: typeof record.bounds === 'string' ? record.bounds : undefined,
      text: typeof record.text === 'string' ? record.text : undefined,
    })
  }
  Object.values(record).forEach(child => collectUiNodes(child, result))
  return result
}

async function dumpUiNodes() {
  await adb(['shell', 'uiautomator', 'dump', UI_DUMP_PATH])
  const { stdout } = await adb(['exec-out', 'cat', UI_DUMP_PATH])
  await adb(['shell', 'rm', '-f', UI_DUMP_PATH])
  return collectUiNodes(parser.parse(stdout))
}

async function waitForTexts(expected: string[], timeoutMs = 15_000) {
  const startedAt = Date.now()
  let latest: UiNode[] = []
  while (Date.now() - startedAt < timeoutMs) {
    latest = await dumpUiNodes()
    const texts = new Set(latest.map(node => node.text).filter(Boolean))
    if (expected.every(text => texts.has(text))) {
      return latest
    }
    await delay(300)
  }
  const actual = [...new Set(latest.map(node => node.text).filter(Boolean))]
  throw new Error(`等待 QuickApp 文本超时。期望：${expected.join(', ')}；实际：${actual.join(', ')}`)
}

async function launchRoute(route: string, expected: string[]) {
  await adb([
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `hap://app/${QUICKAPP_PACKAGE}/${route}`,
  ])
  return await waitForTexts(expected)
}

async function tapText(text: string) {
  const nodes = await waitForTexts([text])
  const target = nodes.find(node => node.text === text && node.bounds)
  const match = target?.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/)
  if (!match) {
    throw new Error(`无法解析 QuickApp 文本 ${text} 的点击区域：${target?.bounds ?? '<missing>'}`)
  }
  const [, left, top, right, bottom] = match.map(Number)
  await adb(['shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2))])
}

async function waitForRunApp() {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 60_000) {
    if (/通知手机更新rpk文件成功|请求.*\/update.*成功/.test(runAppLog)) {
      return
    }
    if (typeof runAppProcess?.exitCode === 'number') {
      throw new TypeError(`hap runapp 提前退出：\n${runAppLog}`)
    }
    await delay(300)
  }
  throw new Error(`等待 hap runapp 更新设备超时：\n${runAppLog}`)
}

function appendRunAppLog(chunk: Uint8Array) {
  runAppLog += Buffer.from(chunk).toString()
  if (!skippedWifiPrompt && runAppLog.includes('选择是否要连接新的wifi设备')) {
    skippedWifiPrompt = true
    runAppProcess?.stdin?.write('\u001B[B\r')
  }
}

beforeAll(async () => {
  const hapCommand = resolveHapCommand()
  if (!await fs.pathExists(hapCommand)) {
    throw new Error(`未找到 hap-toolkit CLI：${hapCommand}`)
  }
  adbSerial = await resolveDeviceSerial()
  for (const packageName of REQUIRED_HOST_PACKAGES) {
    const { stdout } = await adb(['shell', 'pm', 'path', packageName])
    if (!stdout.includes('package:')) {
      throw new Error(`ADB 设备缺少 QuickApp 运行环境：${packageName}`)
    }
  }

  await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'quickapp', '--quickapp-e2e'], {
    stdio: 'inherit',
  })
  runAppProcess = execa(hapCommand, ['runapp'], {
    cwd: OUTPUT_ROOT,
    reject: false,
    stderr: 'pipe',
    stdin: 'pipe',
    stdout: 'pipe',
  })
  runAppProcess.stdout?.on('data', appendRunAppLog)
  runAppProcess.stderr?.on('data', appendRunAppLog)
  await waitForRunApp()
})

afterAll(async () => {
  if (!runAppProcess) {
    return
  }
  runAppProcess.kill('SIGINT')
  await Promise.race([runAppProcess, delay(5_000)])
  if (typeof runAppProcess.exitCode !== 'number') {
    runAppProcess.kill('SIGKILL')
    await runAppProcess
  }
})

describe.sequential('QuickApp runtime on Android', () => {
  it.each([
    ['native/reactivity', ['Native reactivity', 'count=1', 'double=2']],
    ['vue/reactivity', ['Vue reactivity', 'count=1', 'double=2']],
  ])('updates reactivity on %s', async (route, initialTexts) => {
    await launchRoute(route, initialTexts)
    await tapText('increment')
    const updatedTexts = route.startsWith('vue/')
      ? ['count=2', 'double=4', 'watch=1']
      : ['count=2', 'double=4']
    await waitForTexts(updatedTexts)
  })

  it.each([
    ['native/list', ['Native list', '0:alpha', '1:beta']],
    ['vue/list', ['Vue list', '0:alpha', '1:beta']],
    ['native/lifecycle', ['mounted']],
    ['vue/lifecycle', ['mounted']],
  ])('renders list and lifecycle state on %s', async (route, expectedTexts) => {
    await launchRoute(route, expectedTexts)
  })

  it('supports Vue component props and emitted events', async () => {
    await launchRoute('vue/components', ['Vue component', 'count=1', 'child increment'])
    await tapText('child increment')
    await waitForTexts(['count=2'])
  })

  it('supports Vue Options API state and methods', async () => {
    await launchRoute('vue/options', ['count=1', 'increment'])
    await tapText('increment')
    await waitForTexts(['count=2'])
  })

  it.each(['native/api', 'vue/api'])('supports declared system APIs on %s', async (route) => {
    await launchRoute(route, ['idle', 'read device'])
    await tapText('read device')
    await waitForTexts(['supported'])
  })
})
