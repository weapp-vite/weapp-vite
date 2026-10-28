import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { resultExitCode } from './index.mjs'

const limits = { url: 2_000, title: 500, bodyText: 12_000, controls: 100, headings: 50, entry: 500 }

function boundedText(value, limit) {
  const text = value ?? ''
  const retained = text.slice(0, limit)
  return { value: retained, observation: { originalCharacters: text.length, retainedCharacters: retained.length, truncated: retained.length < text.length } }
}

function boundedList(values, limit) {
  const list = values ?? []
  const selected = list.slice(0, limit).map(value => boundedText(value, limits.entry))
  return {
    value: selected.map(entry => entry.value),
    observation: {
      originalCount: list.length,
      retainedCount: selected.length,
      omittedCount: list.length - selected.length,
      truncatedEntries: selected.filter(entry => entry.observation.truncated).length,
      entryCharacterLimit: limits.entry,
    },
  }
}

/** 完整观察仅参与策略；写入诊断时保留明确的原始数量与裁剪事实。 */
function diagnosticPageState(state) {
  const text = Object.fromEntries(['url', 'title', 'bodyText'].map(key => [key, boundedText(state[key], limits[key])]))
  const lists = Object.fromEntries(['controls', 'headings'].map(key => [key, boundedList(state[key], limits[key])]))
  const fields = { ...text, ...lists }
  return {
    httpStatus: state.httpStatus,
    ...Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])),
    observation: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.observation])),
  }
}

/** 清理失败附带的原始刷新结果也使用相同诊断边界，不更改其终态或输入。 */
function diagnosticResult(result) {
  return {
    ...result,
    ...(result.pageState ? { pageState: diagnosticPageState(result.pageState) } : {}),
    ...(result.refreshResult ? { refreshResult: diagnosticResult(result.refreshResult) } : {}),
  }
}

/**
 * 创建每次调用独立的证据报告器，可按需追加工作流摘要。
 * @param {{rootDirectory: string, summaryPath?: string, log?: (summary: string) => void}} options 证据根目录及可选摘要输出。
 */
export function createReporter({ rootDirectory, summaryPath, log = console.log }) {
  const invocationId = randomUUID()
  let reportAttempt = 0
  return async (result, page) => {
    const attempt = ++reportAttempt
    const diagnosticDirectory = `${rootDirectory}/${invocationId}/${attempt}`
    const evidence = { ...diagnosticResult(result), invocationId, reportAttempt: attempt, screenshot: { captured: false } }
    await mkdir(diagnosticDirectory, { recursive: true })
    // 每次报告拥有独立目录；清理或摘要失败后的报告保留此前终态与截图。
    if (resultExitCode(result) !== 0 && page) {
      try {
        await page.screenshot({ path: `${diagnosticDirectory}/page.png`, fullPage: true, timeout: 5_000 })
        evidence.screenshot = { captured: true, path: 'page.png' }
      }
      catch (error) {
        evidence.screenshot.error = { name: error.name, message: error.message }
      }
    }
    await writeFile(`${diagnosticDirectory}/result.json`, `${JSON.stringify(evidence, null, 2)}\n`)
    const lines = [
      `## DeepWiki refresh: ${result.status}`,
      '',
      `- Reason: ${result.reason}`,
      `- Evidence invocation: \`${invocationId}/${attempt}\``,
      ...(result.mainSha ? [`- main: \`${result.mainSha}\``] : []),
      ...(result.index ? [`- DeepWiki: \`${result.index.sha}\` (${result.index.dateText})`] : []),
      ...(result.status === 'blocked' ? ['- Result: identity verification is required; no identity was submitted and no refresh was completed.'] : []),
      ...(evidence.pageState ? [`- Page: HTTP ${evidence.pageState.httpStatus ?? 'unknown'}; ${evidence.pageState.title}; ${evidence.pageState.url}`] : []),
    ]
    const summary = `${lines.join('\n')}\n`
    log(summary)
    if (summaryPath) {
      await appendFile(summaryPath, summary)
    }
  }
}
