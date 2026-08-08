export interface BenchmarkCheckoutPreparationCommand {
  command: string
  args: string[]
}

export function createBenchmarkCheckoutPreparationCommands(): BenchmarkCheckoutPreparationCommand[] {
  return [
    {
      command: 'pnpm',
      args: ['--filter', '@wevu/api', 'catalog:sync'],
    },
    {
      command: 'pnpm',
      args: ['--filter', '@wevu/api', 'docs:sync'],
    },
  ]
}
