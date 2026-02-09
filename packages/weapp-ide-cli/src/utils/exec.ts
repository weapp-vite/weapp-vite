import process from 'node:process'

interface ExecuteOptions {
  pipeStdout?: boolean
  pipeStderr?: boolean
}

/**
 * @description 执行 CLI 命令并透传输出
 */
export async function execute(cliPath: string, argv: string[], options: ExecuteOptions = {}) {
  const {
    pipeStdout = true,
    pipeStderr = true,
  } = options

  const { execa } = await import('execa')
  const task = execa(cliPath, argv)

  if (pipeStdout) {
    task?.stdout?.pipe(process.stdout)
  }
  if (pipeStderr) {
    task?.stderr?.pipe(process.stderr)
  }

  return await task
}
