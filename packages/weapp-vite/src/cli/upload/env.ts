import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseEnv } from 'node:util'
import { expand } from 'dotenv-expand'

/** 凭据不经过 Vite 的 env 调试日志；文件优先级和进程环境覆盖规则保持一致。 */
export async function loadUploadEnv(cwd: string, mode: string, root?: string, envDir?: string | false): Promise<NodeJS.ProcessEnv> {
  if (envDir === false) {
    return { ...process.env }
  }
  if (mode === 'local') {
    throw new Error('local 不能作为 mode，因为它与 .env.local 文件后缀冲突。')
  }
  const directory = path.resolve(cwd, root ?? '.', envDir ?? '.')
  const parsed: Record<string, string> = {}
  for (const file of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    const content = await readFile(path.join(directory, file), 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return ''
      }
      throw error
    })
    Object.assign(parsed, parseEnv(content))
  }
  // 提前提供全部文件变量以支持反向引用；始终使用副本，不把凭据写回 process.env。
  const processEnv = { ...parsed }
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      processEnv[key] = value
    }
  }
  expand({ parsed, processEnv })
  return { ...parsed, ...process.env }
}
