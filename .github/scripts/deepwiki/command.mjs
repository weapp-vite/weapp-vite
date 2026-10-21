export function resolveMode(args = []) {
  if (args.length === 0) {
    return 'monitor'
  }
  if (args.length === 1 && ['--mode=monitor', '--mode=refresh'].includes(args[0])) {
    return args[0].slice('--mode='.length)
  }
  throw new Error('DeepWiki requires one explicit --mode=monitor or --mode=refresh option')
}

/** 默认只读；只有明确选择刷新后才加载浏览器及其控制器。 */
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
