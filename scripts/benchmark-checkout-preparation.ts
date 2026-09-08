export interface BenchmarkCheckoutPreparationCommand {
  command: string
  args: string[]
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
