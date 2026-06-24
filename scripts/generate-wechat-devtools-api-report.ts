import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const REPORT_PATH = path.resolve('docs/reports/wechat-devtools-api-surface.md')
const DEFAULT_MAC_DEVTOOLS_APP_PATH = '/Applications/wechatwebdevtools.app'

interface Row {
  [key: string]: string
}

interface DevtoolsMetadata {
  appPath: string
  buildTime: string
  packageJsonPath: string
  productName: string
  version: string
}

const httpRows: Row[] = [
  { endpoint: 'GET /open', query: 'projectpath=<absolute project path>', result: '打开或刷新目标项目', source: 'packages/weapp-ide-cli/src/cli/http.ts', note: '服务端口默认 9420；优先读取 DevTools 设置里的端口' },
  { endpoint: 'GET /v2/resetfileutils', query: 'project=<absolute project path>', result: '重置当前项目 fileutils 状态', source: 'packages/weapp-ide-cli/src/cli/http.ts', note: '用于修复 IDE 文件状态缓存' },
  { endpoint: 'GET /engine/build', query: 'projectpath=<absolute project path>', result: '触发 engine build', source: 'packages/weapp-ide-cli/src/cli/http.ts', note: '返回原始 body' },
  { endpoint: 'GET /engine/buildResult/', query: '-', result: '轮询 engine build 状态', source: 'packages/weapp-ide-cli/src/cli/http.ts', note: '已知状态：NOT_START / OPEN_PROJECT / BUILDING / END / ERROR' },
]

const wsRows: Row[] = [
  { domain: 'App', method: 'App.getPageStack', params: '-', result: 'pageStack', source: 'MiniProgram.pageStack/currentPage/changeRoute', note: '读取页面栈，也用于 currentPage 超时兜底' },
  { domain: 'App', method: 'App.getCurrentPage', params: '-', result: 'pageId/path/query', source: 'MiniProgram.currentPage/changeRoute', note: '当前页探测和路由等待' },
  { domain: 'App', method: 'App.callWxMethod', params: 'method, args, pluginId?', result: 'result', source: 'MiniProgram.callWxMethod/callPluginWxMethod', note: '导航、系统信息、宿主 wx API 调用入口' },
  { domain: 'App', method: 'App.mockWxMethod', params: 'method, result?, functionDeclaration?, pluginId?, args?', result: '-', source: 'MiniProgram.mockWxMethod/mockPluginWxMethod', note: 'mock/restore wx API' },
  { domain: 'App', method: 'App.callFunction', params: 'functionDeclaration, args', result: 'result', source: 'MiniProgram.evaluate', note: '在 App 上下文执行函数' },
  { domain: 'App', method: 'App.exit', params: '-', result: '-', source: 'MiniProgram.close', note: '关闭小程序运行实例' },
  { domain: 'App', method: 'App.enableLog', params: '-', result: '-', source: 'MiniProgram.enableLog', note: '启用 console 事件转发' },
  { domain: 'App', method: 'App.addBinding', params: 'name', result: '-', source: 'MiniProgram.exposeFunction', note: '暴露绑定函数给小程序侧调用' },
  { domain: 'App', method: 'App.captureScreenshot', params: '-', result: 'data', source: 'MiniProgram.waitForAppReady/screenshot', note: '截图和 App 域 ready 探测' },
  { domain: 'Tool', method: 'Tool.close', params: '-', result: '-', source: 'MiniProgram.close', note: '关闭 DevTools 自动化会话' },
  { domain: 'Tool', method: 'Tool.enableRemoteDebug', params: 'auto', result: 'qrCode?', source: 'MiniProgram.remote', note: '开启远程调试' },
  { domain: 'Tool', method: 'Tool.getInfo', params: '-', result: 'SDKVersion 等信息', source: 'MiniProgram.checkVersion/toolInfo', note: '版本与工具信息' },
  { domain: 'Tool', method: 'Tool.compile', params: 'compile options', result: 'compile result', source: 'MiniProgram.compile', note: '触发 IDE 编译' },
  { domain: 'Tool', method: 'Tool.clearCache', params: 'clean options', result: 'clear result', source: 'MiniProgram.clearCache', note: '清理 IDE 缓存' },
  { domain: 'Tool', method: 'Tool.stopAudits', params: '-', result: 'data/report', source: 'MiniProgram.stopAudits', note: '结束体验评分并读取报告' },
  { domain: 'Tool', method: 'Tool.getTicket', params: '-', result: 'ticket payload', source: 'MiniProgram.getTicket', note: '读取登录 ticket' },
  { domain: 'Tool', method: 'Tool.setTicket', params: 'ticket', result: '-', source: 'MiniProgram.setTicket', note: '写入登录 ticket' },
  { domain: 'Tool', method: 'Tool.refreshTicket', params: '-', result: '-', source: 'MiniProgram.refreshTicket', note: '刷新登录 ticket' },
  { domain: 'Tool', method: 'Tool.getTestAccounts', params: '-', result: 'accounts', source: 'MiniProgram.testAccounts', note: '读取测试账号' },
  { domain: 'Tool', method: 'Tool.native', params: 'method, data?', result: 'native result', source: 'Native.sendNative', note: '原生弹窗/授权/分享/支付等宿主 UI 操作' },
  { domain: 'Tool', method: 'Tool.<method>', params: 'params', result: 'method result', source: 'MiniProgram.tool', note: '显式开放 Tool 域透传入口' },
  { domain: 'Page', method: 'Page.getElement', params: 'pageId, selector', result: 'element', source: 'Page.$', note: '查找单个节点' },
  { domain: 'Page', method: 'Page.getElements', params: 'pageId, selector', result: 'elements', source: 'Page.$$', note: '查找多个节点' },
  { domain: 'Page', method: 'Page.getElementByXpath', params: 'pageId, selector', result: 'element', source: 'Page.$x', note: 'XPath 单节点查询' },
  { domain: 'Page', method: 'Page.getElementsByXpath', params: 'pageId, selector', result: 'elements', source: 'Page.$$x', note: 'XPath 多节点查询' },
  { domain: 'Page', method: 'Page.getData', params: 'pageId, path?', result: 'data', source: 'Page.data', note: '读取页面 data' },
  { domain: 'Page', method: 'Page.setData', params: 'pageId, data', result: '-', source: 'Page.setData', note: '写入页面 data' },
  { domain: 'Page', method: 'Page.callMethod', params: 'pageId, method, args', result: 'result', source: 'Page.callMethod', note: '调用页面实例方法' },
  { domain: 'Page', method: 'Page.getWindowProperties', params: 'pageId, names', result: 'properties', source: 'Page.windowProperty/size/scrollTop', note: '读取 window/document 属性' },
  { domain: 'Element', method: 'Element.getElement', params: 'pageId, elementId, selector', result: 'element', source: 'Element.$', note: '在元素内查找单个子节点' },
  { domain: 'Element', method: 'Element.getElements', params: 'pageId, elementId, selector', result: 'elements', source: 'Element.$$', note: '在元素内查找多个子节点' },
  { domain: 'Element', method: 'Element.getOffset', params: 'pageId, elementId', result: 'offset', source: 'Element.offset', note: '读取节点位置' },
  { domain: 'Element', method: 'Element.getWXML', params: 'pageId, elementId, type', result: 'wxml', source: 'Element.wxml/outerWxml', note: '读取 inner/outer WXML' },
  { domain: 'Element', method: 'Element.tap', params: 'pageId, elementId', result: '-', source: 'Element.tap', note: '点击节点' },
  { domain: 'Element', method: 'Element.triggerEvent', params: 'pageId, elementId, type, detail?', result: '-', source: 'Element.trigger', note: '触发组件事件' },
  { domain: 'Element', method: 'Element.touchstart', params: 'pageId, elementId, touches?', result: '-', source: 'Element.touchstart', note: '触摸开始' },
  { domain: 'Element', method: 'Element.touchmove', params: 'pageId, elementId, touches?', result: '-', source: 'Element.touchmove', note: '触摸移动' },
  { domain: 'Element', method: 'Element.touchend', params: 'pageId, elementId, changedTouches?', result: '-', source: 'Element.touchend', note: '触摸结束' },
  { domain: 'Element', method: 'Element.dispatchEvent', params: 'pageId, elementId, eventName, detail?', result: '-', source: 'Element.dispatchEvent', note: '派发 DOM 事件' },
  { domain: 'Element', method: 'Element.callFunction', params: 'pageId, elementId, functionName, args', result: 'result', source: 'Element.callFunction', note: '调用内置元素函数，如 input.input' },
  { domain: 'Element', method: 'Element.setData', params: 'pageId, elementId, data', result: '-', source: 'CustomElement.setData', note: '写入自定义组件 data' },
  { domain: 'Element', method: 'Element.getData', params: 'pageId, elementId, path?', result: 'data', source: 'CustomElement.data', note: '读取自定义组件 data' },
  { domain: 'Element', method: 'Element.callMethod', params: 'pageId, elementId, method, args', result: 'result', source: 'CustomElement.callMethod', note: '调用自定义组件方法' },
  { domain: 'Element', method: 'Element.callContextMethod', params: 'pageId, elementId, method, args', result: 'result', source: 'ContextElement.callContextMethod', note: '调用 video 等上下文方法' },
  { domain: 'Element', method: 'Element.getDOMProperties', params: 'pageId, elementId, names', result: 'properties', source: 'Element.domProperty', note: '读取 offsetWidth/innerText 等 DOM 属性' },
  { domain: 'Element', method: 'Element.getAttributes', params: 'pageId, elementId, names', result: 'attributes', source: 'Element.attribute', note: '读取属性' },
  { domain: 'Element', method: 'Element.getStyles', params: 'pageId, elementId, names', result: 'styles', source: 'Element.style', note: '读取样式' },
  { domain: 'Element', method: 'Element.getProperties', params: 'pageId, elementId, names', result: 'properties', source: 'Element.property/_property', note: '读取组件公开属性' },
]

const eventRows: Row[] = [
  { event: 'App.logAdded', payload: 'console payload', source: 'MiniProgram.on("console")', note: '启用 App.enableLog 后转发' },
  { event: 'App.bindingCalled', payload: 'name, args', source: 'MiniProgram.exposeFunction', note: '小程序侧调用绑定函数' },
  { event: 'App.exceptionThrown', payload: 'exception payload', source: 'MiniProgram constructor', note: '小程序异常事件' },
  { event: 'Tool.onRemoteDebugConnected', payload: '-', source: 'MiniProgram.remote', note: '远程调试连接完成' },
]

const nativeRows: Row[] = [
  'goHome',
  'navigateLeft',
  'confirmModal',
  'cancelModal',
  'switchTab',
  'authorizeCancel',
  'authorizeAllow',
  'closePaymentDialog',
  'shareCancel',
  'shareConfirm',
].map(method => ({ method, transport: 'Tool.native', params: method === 'switchTab' ? 'url' : '-', source: 'packages/miniprogram-automator/src/Native.ts' }))

const mcpRows: Row[] = [
  { tool: 'weapp_devtools_connect', mapsTo: 'currentPage, systemInfo -> App.getCurrentPage/App.callWxMethod', note: '连接并返回当前页和系统信息' },
  { tool: 'weapp_devtools_active_page', mapsTo: 'Page.getWindowProperties/Page.getData', note: '读取当前页状态' },
  { tool: 'weapp_devtools_page_stack', mapsTo: 'App.getPageStack', note: '读取页面栈' },
  { tool: 'weapp_runtime_find_node', mapsTo: 'Page.getElement + Element snapshot methods', note: '单节点快照' },
  { tool: 'weapp_runtime_find_nodes', mapsTo: 'Page.getElements + Element snapshot methods', note: '多节点快照' },
  { tool: 'weapp_runtime_tap_node', mapsTo: 'Page.getElement + Element.tap', note: '点击节点' },
  { tool: 'weapp_runtime_input_node', mapsTo: 'Page.getElement + Element.callFunction', note: '输入文本' },
  { tool: 'weapp_devtools_capture', mapsTo: 'App.captureScreenshot', note: '截图并可保存到文件' },
  { tool: 'weapp_devtools_host_api', mapsTo: 'App.callWxMethod', note: '调用 wx API' },
]

function readJsonObject(filePath: string) {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
}

function readString(object: Record<string, unknown>, key: string) {
  const value = object[key]
  return typeof value === 'string' ? value : ''
}

function resolveDevtoolsMetadata(): DevtoolsMetadata {
  const appPath = process.env.WECHAT_DEVTOOLS_APP_PATH || DEFAULT_MAC_DEVTOOLS_APP_PATH
  const packageJsonPath = appPath.endsWith('package.json')
    ? appPath
    : path.join(appPath, 'Contents/Resources/package.nw/package.json')
  if (!fs.existsSync(packageJsonPath)) {
    return { appPath, buildTime: '未检测到', packageJsonPath, productName: '未检测到', version: '未检测到' }
  }
  const json = readJsonObject(packageJsonPath)
  const rawBuildTime = json.buildTime
  const buildTime = typeof rawBuildTime === 'number'
    ? `${rawBuildTime} (${new Date(rawBuildTime).toISOString()})`
    : String(rawBuildTime ?? '未检测到')
  return {
    appPath,
    buildTime,
    packageJsonPath,
    productName: readString(json, 'productName') || readString(json, 'name') || '未检测到',
    version: readString(json, 'version') || '未检测到',
  }
}

function escapeCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function table(headers: string[], rows: Row[]) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${headers.map(header => escapeCell(row[header] ?? '')).join(' | ')} |`),
  ].join('\n')
}

function extractLiteralMethods(files: string[]) {
  const methods = new Set<string>()
  const pattern = /send\('([A-Za-z]+\.[^']+)'/g
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    for (const match of content.matchAll(pattern)) {
      methods.add(match[1])
    }
  }
  return [...methods].sort()
}

function assertSourceCoverage() {
  const knownHttp = new Set(httpRows.map(row => row.endpoint.replace(/^GET /, '')))
  const httpContent = fs.readFileSync('packages/weapp-ide-cli/src/cli/http.ts', 'utf8')
  for (const match of httpContent.matchAll(/requestWechatDevtoolsHttp\('([^']+)'/g)) {
    if (!knownHttp.has(match[1])) {
      throw new Error(`HTTP endpoint missing from report: ${match[1]}`)
    }
  }

  const knownWs = new Set(wsRows.map(row => row.method))
  const methods = extractLiteralMethods([
    'packages/miniprogram-automator/src/MiniProgram.ts',
    'packages/miniprogram-automator/src/Page.ts',
    'packages/miniprogram-automator/src/Element.ts',
    'packages/miniprogram-automator/src/Native.ts',
  ])
  const missing = methods.filter(method => !knownWs.has(method))
  if (missing.length > 0) {
    throw new Error(`WebSocket methods missing from report: ${missing.join(', ')}`)
  }
}

function readExistingGeneratedAt() {
  if (!fs.existsSync(REPORT_PATH)) {
    return undefined
  }
  const content = fs.readFileSync(REPORT_PATH, 'utf8')
  return content.match(/\| 生成时间 \| ([^|]+) \|/)?.[1]?.trim()
}

function createReport(generatedAt: string) {
  const metadata = resolveDevtoolsMetadata()
  return `# 微信开发者工具 API Surface 报告

> 本报告由 \`pnpm report:wechat-devtools-api\` 生成。微信开发者工具更新后重新运行该命令；提交前可运行 \`pnpm check:wechat-devtools-api-report\` 检查报告是否与当前源码和本机 DevTools 版本一致。

## 范围

这里的“暴露给当前仓库/AI 工具的 API”指 weapp-vite 通过 \`weapp-ide-cli\`、\`miniprogram-automator\` 和 MCP 工具实际封装并可调用的 DevTools HTTP 服务端口与 automator WebSocket 协议面。微信开发者工具内部未被当前仓库调用的私有接口不视为稳定可用面。

## 元信息

${table(['key', 'value'], [
  { key: '生成时间', value: generatedAt },
  { key: 'DevTools 应用路径', value: metadata.appPath },
  { key: 'DevTools package.json', value: metadata.packageJsonPath },
  { key: 'DevTools 产品名', value: metadata.productName },
  { key: 'DevTools 版本', value: metadata.version },
  { key: 'DevTools buildTime', value: metadata.buildTime },
  { key: 'HTTP 服务端口', value: '默认 9420；运行时优先读取微信开发者工具设置/本仓库 runtime port' },
  { key: 'Automator WS 地址', value: '通过 DevTools CLI auto 启动，连接 ws://127.0.0.1:<auto-port>' },
])}

## HTTP 服务端口

${table(['endpoint', 'query', 'result', 'source', 'note'], httpRows)}

## Automator WebSocket 方法

请求形态为 JSON：\`{ id, method, params }\`。响应按同一 \`id\` 回包；事件没有 \`id\`，通过 \`method\` 区分。

${table(['domain', 'method', 'params', 'result', 'source', 'note'], wsRows)}

## Automator WebSocket 事件

${table(['event', 'payload', 'source', 'note'], eventRows)}

## Tool.native 子命令

这些不是独立 WS method，而是 \`Tool.native\` 的 \`params.method\`。

${table(['method', 'transport', 'params', 'source'], nativeRows)}

## MCP 工具映射

MCP 工具是本仓库面向 AI/客户端暴露的包装层，不是微信开发者工具原生接口；底层仍走上面的 HTTP/WS 能力。

${table(['tool', 'mapsTo', 'note'], mcpRows)}
`
}

function main() {
  const check = process.argv.includes('--check')
  assertSourceCoverage()
  const generatedAt = check ? readExistingGeneratedAt() ?? new Date().toISOString() : new Date().toISOString()
  const next = createReport(generatedAt)

  if (check) {
    const current = fs.existsSync(REPORT_PATH) ? fs.readFileSync(REPORT_PATH, 'utf8') : ''
    if (current !== next) {
      throw new Error(`报告已过期，请运行 pnpm report:wechat-devtools-api 刷新 ${path.relative(process.cwd(), REPORT_PATH)}`)
    }
    console.log('wechat-devtools-api report is up to date')
    return
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, next)
  console.log(`wrote ${path.relative(process.cwd(), REPORT_PATH)}`)
}

main()
