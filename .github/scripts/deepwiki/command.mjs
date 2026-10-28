/**
 * 解析显式模式参数，默认保持只读。
 * @param {string[]} args 命令行参数。
 */
export function resolveMode(args = []) {
  if (args.length === 0) {
    return 'monitor'
  }
  if (args.length === 1 && ['--mode=monitor', '--mode=refresh'].includes(args[0])) {
    return args[0].slice('--mode='.length)
  }
  throw new Error('DeepWiki requires one explicit --mode=monitor or --mode=refresh option')
}

/**
 * 默认只读；只有明确选择刷新后才加载浏览器及其控制器。
 * @param {{args?: string[], mainSha?: string, summaryPath?: string, loadMonitor?: () => Promise<{run: (options: {mainSha: string | undefined, summaryPath: string | undefined}) => Promise<number>}>, loadRefresh?: () => Promise<{run: (options: {mainSha: string | undefined, summaryPath: string | undefined}) => Promise<number>}>}} options 执行参数及延迟加载入口。
 */
export async function runDeepWikiCommand({
  args = [],
  mainSha,
  summaryPath,
  loadMonitor = () => import('./monitor.mjs'),
  loadRefresh = () => import('../refresh-deepwiki/command.mjs'),
} = {}) {
  const mode = resolveMode(args)
  const command = await (mode === 'monitor' ? loadMonitor() : loadRefresh())
  return command.run({ mainSha, summaryPath })
}
