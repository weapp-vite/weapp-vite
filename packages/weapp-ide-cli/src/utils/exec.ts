import process from 'node:process'

export async function execute(cliPath: string, argv: string[]) {
  const { execa } = await import('execa')
  const task = execa(cliPath, argv)

  task?.stdout?.pipe(process.stdout)
  task?.stderr?.pipe(process.stderr)

  await task
}
