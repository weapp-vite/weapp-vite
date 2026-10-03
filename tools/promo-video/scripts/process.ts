import { spawn } from 'node:child_process'

/** 直接调用可执行文件，避免经由 shell 解释路径与参数。 */
export async function runProcess(command: string, args: string[], inherit = false, cwd?: string) {
  return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8').on('data', (data: string) => {
      stdout += data
    })
    child.stderr?.setEncoding('utf8').on('data', (data: string) => {
      stderr += data
    })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(`${command} exited with ${signal ?? code}\n${stderr.slice(-6000)}`))
    })
  })
}
