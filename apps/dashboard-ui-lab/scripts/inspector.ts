import type { Interface } from 'node:readline'
import type { AnalyzeDashboardDevframeController } from 'weapp-vite/dashboard'
import type { InspectorFixture, InspectorFixtureState } from './inspectorFixture'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createBaselineState, createInspectorFixture, FIXTURE_PROJECT_NAME, LONG_FILE, SELECTED_FILE, SELECTED_SOURCE } from './inspectorFixture'
import { createInspectorTemporaryRoot } from './inspectorTemporaryRoot'

interface InspectorHostHandle extends Pick<AnalyzeDashboardDevframeController, 'update'> {
  urls: string[]
  close: () => Promise<void>
  waitForExit: () => Promise<void>
}

const labRoot = fileURLToPath(new URL('../', import.meta.url))
const help = `
Host options:
  --vite-devtools    使用真实 Vite DevTools 宿主；不指定时仍为独立 Dashboard
  --panel-base PATH  宿主模式下的 Dashboard 挂载目录（例如 /qa/dashboard/）
  --app-base PATH    宿主模式下的 Vite 输入应用 base（例如 /lab/）

Inspector fixture commands (one command per line):
  baseline / reset  恢复基线报告、全部临时源码；同身份的 UI 折叠状态由 Dashboard 保留
  related           所选模块源码/贡献增大，新增一个关联产物；首次增加动态 import
  unrelated         仅更新 packages/unrelated/independent.js 及其独立模块
  same              重建并推送完全相同的报告、源码与内存产物，验证不产生未读
  delete            从全部产物与模块索引移除 selected-module.ts；保留 inspector.js
  long              扩展为 96+ 个关联产物、72 个额外模块和长路径产物
  source-error      仅移除所选模块的临时源码；报告/内存产物保留，真实 RPC 读取报错
  source-restore    恢复临时源码；报告身份不变（delete 后请 reset）
  status            打印当前场景和稳定选择身份，不推送报告
  help              打印命令
  quit / exit       关闭 Dashboard 并删除本会话临时目录（EOF / Ctrl+C 同样清理）

先在 Treemap 详情中选 __main__ > inspector.js > inspector/selected-module.ts。
关闭“所在产物 · 跨包位置”后运行 related；unrelated / same 不应让该分组出现未读。
选择 inspector.js 可查看模块与静态/动态引用；long 后选择长路径产物可查看长身份与源码。
source-error 后重新打开源码面板，或使用面板重试；应得到“文件不存在。”而非伪造错误。
reset 只重置 fixture 数据；要清空所选身份/未读请先在 UI 切到另一个对象再切回。
此入口没有服务端慢读注入；慢 RPC 只由独立浏览器 QA 延迟真实请求进行验证。
`

async function main() {
  const { values } = parseArgs({
    options: {
      'vite-devtools': { type: 'boolean', default: false },
      'panel-base': { type: 'string' },
      'app-base': { type: 'string' },
    },
  })
  if (!values['vite-devtools'] && (values['panel-base'] !== undefined || values['app-base'] !== undefined)) {
    throw new Error('--panel-base / --app-base 仅用于 --vite-devtools 宿主模式。')
  }
  const temporaryRoot = createInspectorTemporaryRoot('wv-inspector-')
  const srcRoot = path.join(temporaryRoot.root, 'src')
  let dashboard: InspectorHostHandle | undefined
  let input: Interface | undefined
  let stopping = false
  let writtenSources = new Map<string, string>()
  let state = createBaselineState()
  let generatedAt = new Date().toISOString()
  let fixture: InspectorFixture

  const stop = () => {
    stopping = true
    input?.close()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  async function syncSources(sources: Map<string, string>) {
    for (const sourcePath of writtenSources.keys()) {
      if (!sources.has(sourcePath)) {
        await fs.rm(path.join(srcRoot, sourcePath), { force: true })
      }
    }
    for (const [sourcePath, content] of sources) {
      if (writtenSources.get(sourcePath) === content) {
        continue
      }
      const absolutePath = path.join(srcRoot, sourcePath)
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content, 'utf8')
    }
    writtenSources = sources
  }

  function printStatus() {
    const selected = fixture.result.modules.find(module => module.id === SELECTED_SOURCE)
    const locations = selected?.packages.reduce((count, placement) => count + placement.files.length, 0) ?? 0
    console.log(`[fixture] related=${state.relatedVersion}, unrelated=${state.unrelatedVersion}, long=${state.expanded}, deleted=${state.selectedDeleted}, sourceMissing=${state.sourceMissing}`)
    console.log(`[fixture] ${fixture.result.packages.length} packages, ${fixture.result.packages.reduce((count, pkg) => count + pkg.files.length, 0)} artifacts, ${fixture.result.modules.length} modules; selected placements=${locations}`)
    console.log(`[fixture] package=__main__; file=${SELECTED_FILE}; module id/source=${SELECTED_SOURCE}`)
    if (state.expanded) {
      console.log(`[fixture] long file (package=__main__): ${LONG_FILE}`)
    }
  }

  async function publish(nextState: InspectorFixtureState, timestamp = new Date().toISOString()) {
    const next = createInspectorFixture(nextState, timestamp)
    await syncSources(next.sources)
    await dashboard!.update(next.result, next.artifacts)
    state = nextState
    generatedAt = timestamp
    fixture = next
    printStatus()
  }

  try {
    fixture = createInspectorFixture(state, generatedAt)
    await syncSources(fixture.sources)
    if (values['vite-devtools']) {
      // 实验入口验证宿主加载边界；静态导入会让独立场景也加载可选 DevTools SDK。
      const { startInspectorViteHost } = await import('./inspectorViteHost')
      dashboard = await startInspectorViteHost({
        cwd: labRoot,
        snapshot: { current: fixture.result, previous: null, artifacts: fixture.artifacts },
        roots: { projectRoot: labRoot, srcRoot },
        panelBase: values['panel-base'],
        appBase: values['app-base'],
      })
    }
    else {
      // Vite 宿主场景必须只消费公开核心入口，不能顺带加载 CLI 启动器。
      const { startAnalyzeDashboard } = await import('../../../packages/weapp-vite/src/cli/analyze/dashboard')
      dashboard = await startAnalyzeDashboard(fixture.result, {
        artifacts: fixture.artifacts,
        cwd: labRoot,
        srcRoot,
        watch: true,
        silentStartupLog: true,
      }) || undefined
    }
    if (!dashboard?.urls.length) {
      throw new Error('Inspector fixture 无法启动真实 Dashboard；请先安装仓库依赖并准备 @weapp-vite/dashboard。')
    }
    if (stopping) {
      return
    }
    console.log(`\n${FIXTURE_PROJECT_NAME}`)
    console.log('独立实验会话：复用真实 Dashboard / OTP / scoped RPC；不替换正常 dev:ui / build:ui 报告。')
    for (const url of dashboard.urls) {
      console.log(`Dashboard URL (OTP): ${url}`)
    }
    console.log(help)
    printStatus()

    input = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY) })
    input.on('SIGINT', stop)
    void dashboard.waitForExit().then(stop)
    input.setPrompt('inspector> ')
    if (input.terminal) {
      input.prompt()
    }
    for await (const line of input) {
      if (stopping) {
        break
      }
      const command = line.trim().toLowerCase()
      if (command === 'quit' || command === 'exit') {
        break
      }
      try {
        switch (command) {
          case 'baseline':
          case 'reset':
            await publish(createBaselineState())
            break
          case 'related':
            if (state.selectedDeleted) {
              console.log('[fixture] 所选模块已删除；先 reset，再运行 related。')
              break
            }
            await publish({ ...state, relatedVersion: state.relatedVersion + 1 })
            break
          case 'unrelated':
            await publish({ ...state, unrelatedVersion: state.unrelatedVersion + 1 })
            break
          case 'same':
            await publish(state, generatedAt)
            break
          case 'delete':
            await publish({ ...state, selectedDeleted: true })
            break
          case 'long':
            await publish({ ...state, expanded: true })
            break
          case 'source-error':
            await publish({ ...state, sourceMissing: true })
            break
          case 'source-restore':
            await publish({ ...state, sourceMissing: false })
            break
          case 'status':
            printStatus()
            break
          case 'help':
            console.log(help)
            break
          case '':
            break
          default:
            console.error(`[fixture] 未知命令：${command}。输入 help 查看可用命令。`)
        }
      }
      catch (error) {
        console.error('[fixture] 场景更新失败：', error)
      }
      if (input.terminal && !stopping) {
        input.prompt()
      }
    }
  }
  finally {
    input?.close()
    try {
      await dashboard?.close()
    }
    finally {
      try {
        temporaryRoot.remove()
        console.log('[fixture] Dashboard 已关闭，本会话临时源码已清理。')
      }
      finally {
        process.removeListener('SIGINT', stop)
        process.removeListener('SIGTERM', stop)
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
