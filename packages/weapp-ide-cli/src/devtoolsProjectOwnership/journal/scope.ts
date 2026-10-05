import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const markerName = '.ownership-scope'
export const managedJournalPrefix = 'task-scope-'
const scopeSchema = z.object({ schemaVersion: z.literal(1), rootPath: z.string().min(1), scopeId: z.string().uuid() }).strict()
type JournalScope = z.infer<typeof scopeSchema>

async function readScope(directory: string) {
  const file = path.join(directory, markerName)
  const stat = await fs.lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return undefined
    }
    throw error
  })
  if (!stat) {
    return undefined
  }
  if (!stat.isFile()) {
    throw new Error('Managed DevTools journal scope must be a regular metadata file.')
  }
  const scope = scopeSchema.parse(JSON.parse(await fs.readFile(file, 'utf8')) as unknown)
  if (!path.isAbsolute(scope.rootPath)) {
    throw new Error('Managed DevTools journal scope root must be absolute.')
  }
  return scope
}

async function assertDirectory(directory: string) {
  if (!(await fs.lstat(directory)).isDirectory()) {
    throw new Error('Managed DevTools journal scope must use regular directories.')
  }
}

/** 只接受创建时登记的根及 children 链；不通过搜索祖先收养未知任务。 */
export async function resolveManagedJournalScope(directory: string): Promise<{ rootPath: string, scopeId?: string }> {
  const selected = path.resolve(directory)
  await assertDirectory(selected)
  const scope = await readScope(selected)
  if (!scope) {
    if (path.basename(selected).startsWith(managedJournalPrefix)) {
      throw new Error('Managed DevTools journal scope metadata is missing; refusing an isolated fallback.')
    }
    return { rootPath: selected }
  }
  await assertDirectory(scope.rootPath)
  const root = await readScope(scope.rootPath)
  if (!root || root.scopeId !== scope.scopeId || root.rootPath !== scope.rootPath) {
    throw new Error('Managed DevTools journal scope identity changed; refusing another task boundary.')
  }
  const rootPath = await fs.realpath(scope.rootPath)
  const currentPath = await fs.realpath(selected)
  const relative = path.relative(scope.rootPath, selected)
  if (relative) {
    const parts = relative.split(path.sep)
    if (path.isAbsolute(relative) || parts.length % 2 !== 0 || parts.some((part, index) => index % 2 === 0 ? part !== 'children' : !part || part === '..')) {
      throw new Error('Managed DevTools journal is outside its registered task children.')
    }
    let current = scope.rootPath
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part)
      await assertDirectory(current)
      if (index % 2 === 1) {
        const registered = await readScope(current)
        if (!registered || registered.rootPath !== scope.rootPath || registered.scopeId !== scope.scopeId) {
          throw new Error('Managed DevTools journal scope chain changed; refusing split task locks.')
        }
      }
    }
  }
  if (path.resolve(rootPath, relative) !== currentPath) {
    throw new Error('Managed DevTools journal path changed from its registered task children.')
  }
  return scope
}

async function writeScope(directory: string, scope: JournalScope) {
  const temporary = path.join(directory, `${markerName}.${randomUUID()}.tmp`)
  try {
    await fs.writeFile(temporary, JSON.stringify(scope), { mode: 0o600, flag: 'wx' })
    await fs.rename(temporary, path.join(directory, markerName))
  }
  finally {
    await fs.rm(temporary, { force: true })
  }
}

/** 调用方持有根锁，或根目录刚创建且尚未发布；scope 身份一经登记不再改变。 */
export async function initializeManagedJournalScope(rootPath: string): Promise<JournalScope> {
  const existing = await readScope(rootPath)
  if (existing) {
    await resolveManagedJournalScope(rootPath)
    return existing
  }
  const scope: JournalScope = { schemaVersion: 1, rootPath: path.resolve(rootPath), scopeId: randomUUID() }
  await writeScope(rootPath, scope)
  return scope
}

/** 子目录创建、登记均在同一根锁内完成；返回前不会暴露缺失作用域的 journal。 */
export async function createManagedChildJournal(parentPath: string, rootPath: string) {
  const scope = await initializeManagedJournalScope(rootPath)
  const children = path.join(parentPath, 'children')
  await fs.mkdir(children, { recursive: true, mode: 0o700 })
  await assertDirectory(children)
  const child = await fs.mkdtemp(path.join(children, managedJournalPrefix))
  await writeScope(child, scope)
  return child
}
