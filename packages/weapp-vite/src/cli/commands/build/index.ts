import type { CAC } from 'cac'
import type { BuildUploadCLIOptions } from '../../upload/options'

export { scheduleCompletedProductionBuildExit, shouldScheduleCompletedProductionBuildExit } from './completion'

export function registerBuildCommand(cli: CAC) {
  cli
    .command('build [root]', 'build for production')
    .option('--target <target>', `[string] transpile target (default: 'modules')`)
    .option('--outDir <dir>', `[string] output directory (default: dist)`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | web | all)`)
    .option('--project-config <path>', `[string] project config path (miniprogram only)`)
    .option(
      '--sourcemap [output]',
      `[boolean | "inline" | "hidden"] output source maps for build (default: false)`,
    )
    .option(
      '--minify [minifier]',
      `[boolean | "terser" | "esbuild"] enable/disable minification, `
      + `or specify minifier to use (default: esbuild)`,
    )
    .option(
      '--emptyOutDir',
      `[boolean] force empty outDir when it's outside of root`,
    )
    .option('-w, --watch', `[boolean] rebuilds when modules have changed on disk`)
    .option('--skipNpm', `[boolean] if skip npm build`)
    .option('-o, --open', `[boolean] open ide`)
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .option('--ide-open-strategy <strategy>', '[string] IDE open strategy (cli | automator)', { default: 'cli' })
    .option('--no-open-recovery', '[boolean] disable automatic target-project open retry (preserves existing IDE windows)')
    .option('--ui', `[boolean] 启动调试 UI（当前提供分析视图）`, { default: false })
    .option('--ui-host <host>', `[string] 启动调试 UI 并选择宿主（standalone | hub）`)
    .option('--analyze', `[boolean] 输出分包分析仪表盘`, { default: false })
    .option('--scope <scope>', `[string] 局部构建范围，例如 main,packages/order`)
    .option('--upload', '[boolean] upload the mini program after this build succeeds')
    .option('--uv <version>', '[string] upload version override (requires --upload)')
    .option('--desc <text>', '[string] upload description override (requires --upload)')
    .option('--bump <release>', '[string] increment local package version (patch | minor | major; requires --upload)')
    .option('--git-desc', '[boolean] use the latest Git commit subject (requires --upload)')
    .option('--dry-run', '[boolean] validate upload output without credentials or SDK calls (requires --upload)')
    .action(async (root: string, options: BuildUploadCLIOptions) => {
      const { runBuildCommand } = await import('./action')
      return runBuildCommand(cli, root, options)
    })
}
