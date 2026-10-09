import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/** 未完成的本租约命令不能因持有进程退出而被新验收直接接管。 */
export async function assertNoIncompleteMachineScopes(directory: string) {
  const scopes = path.join(directory, 'scopes')
  const files = await readdir(scopes).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  })
  for (const file of files) {
    const record: unknown = JSON.parse(await readFile(path.join(scopes, file), 'utf8'))
    if (!record || typeof record !== 'object' || !('sealed' in record) || record.sealed !== true
      || !('completed' in record) || record.completed !== true) {
      throw new Error('Runtime busy: an E2E command scope has unfinished cleanup; preserve the machine lease and its journals.')
    }
  }
}
