import type { CAC } from 'cac'
import type { AnalyzeCLIOptions } from '../../types'

export type { WebAnalyzeResult } from './webResult'
export { createWebAnalyzeResult } from './webResult'

export function registerAnalyzeCommand(cli: CAC) {
  cli
    .command('analyze [root]', 'analyze 两端包体与源码映射')
    .option('--ui-host <host>', `[string] 启动调试 UI 并选择宿主（standalone | hub）`)
    .option('--hmr-profile [file]', `[string | boolean] 分析 HMR JSONL profile，省略值时优先读取配置，否则回退到默认路径`)
    .option('--json', `[boolean] 输出 JSON 结果`)
    .option('--markdown', `[boolean] 输出 Markdown 报告`)
    .option('--report <type>', `[string] 输出指定报告类型（pr）`)
    .option('--budget-check', `[boolean] 检查 analyze 预算，超过预算时返回非 0 退出码`)
    .option('--glass-easel-check', `[boolean] 检查 glass-easel 配置、模板和 SelectorQuery 迁移兼容性`)
    .option('--preload', `[boolean] 分析静态页面跳转、实际分包体积和 preloadRule 额度`)
    .option('--output <file>', `[string] 将分析结果写入指定文件（JSON 或 Markdown）`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | web)`)
    .option('--project-config <path>', `[string] project config path (miniprogram only)`)
    .action(async (root: string, options: AnalyzeCLIOptions) => {
      const { runAnalyzeCommand } = await import('./action')
      return runAnalyzeCommand(root, options)
    })
}
