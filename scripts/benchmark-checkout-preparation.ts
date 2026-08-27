export interface BenchmarkCheckoutPreparationCommand {
  command: string
  args: string[]
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
