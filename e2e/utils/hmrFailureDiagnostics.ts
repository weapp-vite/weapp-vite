import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '../..')

/** 按需冻结失败输入与产物；证据路径只在本地日志中以仓库相对路径展示。 */
export async function createHmrFailureDiagnostics(label: string) {
  if (process.env.WEAPP_VITE_E2E_HMR_DIAGNOSTICS !== '1') {
    return undefined
  }
  const parent = path.join(ROOT, '.tmp/hmr-diagnostics')
  await mkdir(parent, { recursive: true })
  const directory = await mkdtemp(path.join(parent, `${label}-`))
  const relative = path.relative(ROOT, directory).split(path.sep).join('/')
  process.stdout.write(`[hmr-diagnostics] ${relative}\n`)
  const record = async (name: string, value: unknown) => {
    await writeFile(path.join(directory, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`)
  }
  return {
    env: {
      DEBUG: 'weapp-vite:context',
      WEAPP_VITE_HMR_PROFILE_JSON: path.join(directory, 'profile.jsonl'),
    },
    record,
    async snapshot(name: string, project: string, files: string[]) {
      const entries = await Promise.all(files.map(async (file) => {
        const source = path.join(project, file)
        try {
          const [bytes, info] = await Promise.all([readFile(source), stat(source)])
          const target = path.join(directory, name, file)
          await mkdir(path.dirname(target), { recursive: true })
          await writeFile(target, bytes)
          return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), mtimeMs: info.mtimeMs }
        }
        catch (error) {
          return { file, error: error instanceof Error ? error.message : String(error) }
        }
      }))
      await record(name, entries)
    },
    async failure(project: string, output: string, state: unknown) {
      await writeFile(path.join(directory, 'dev.log'), output)
      await record('failure', state)
      await cp(project, path.join(directory, 'fixture'), {
        recursive: true,
        filter: source => !['node_modules', '.git', '.tmp', '.weapp-vite'].includes(path.basename(source)),
      })
      process.stdout.write(`[hmr-diagnostics] failed fixture: ${relative}/fixture\n`)
    },
  }
}
