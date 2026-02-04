import process from 'node:process'

/**
 * @description 执行 CLI 命令并透传输出
 */
export async function execute(cliPath: string, argv: string[]) {
  const { execa } = await import('execa')
  const task = execa(cliPath, argv)

  task?.stdout?.pipe(process.stdout)
  task?.stderr?.pipe(process.stderr)

  await task
}
