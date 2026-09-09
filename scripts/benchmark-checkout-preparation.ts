export interface BenchmarkCheckoutPreparationCommand {
  command: string
  args: string[]
}

/** 准备被测模板的依赖闭包，不把模板自身的构建计入准备阶段。 */
export function createBenchmarkTemplateDependenciesCommand(packageNames: string[]): BenchmarkCheckoutPreparationCommand {
  return {
    command: 'pnpm',
    args: [
      '-r',
      '--filter',
      'weapp-vite...',
      ...Array.from(new Set(packageNames)).sort().flatMap(name => ['--filter', `${name}^...`]),
      '--if-present',
      'build',
    ],
  }
}

/** 对比运行器来自 optimized checkout，必须独立准备它直接导入的工具包。 */
export function createBenchmarkRunnerPreparationCommand(): BenchmarkCheckoutPreparationCommand {
  return {
    command: 'pnpm',
    args: ['--filter', '@weapp-core/shared', '--filter', '@weapp-core/constants', '--if-present', 'build'],
  }
}

export function createBenchmarkCheckoutPreparationCommands(): BenchmarkCheckoutPreparationCommand[] {
  return [
    {
      command: 'pnpm',
      args: ['--filter', '@weapp-core/api', 'catalog:sync'],
    },
    {
      command: 'pnpm',
      args: ['--filter', '@weapp-core/api', 'docs:sync'],
    },
  ]
}
