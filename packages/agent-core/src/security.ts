import type { ToolContext } from './types.js'
import { lstat, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { hash } from './config.js'

export class ApprovalRequired extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApprovalRequired'
  }
}
export function redactor(
  environment: NodeJS.ProcessEnv = process.env,
): (text: string) => string {
  const secrets = Object.entries(environment)
    .filter(
      ([k, v]) => /KEY|TOKEN|SECRET|PASSWORD/i.test(k) && v && v.length >= 8,
    )
    .map(([, v]) => v!)
    .sort((a, b) => b.length - a.length)
  return (text) => {
    for (const secret of secrets) {
      text = text.split(secret).join('[REDACTED]')
    }
    return text
      .replace(/\b(sk-[\w-]{12,}|gh[pousr]_\w{16,})\b/g, '[REDACTED]')
      .replace(/(Bearer\s+)[\w.\-/+=]{10,}/gi, '$1[REDACTED]')
  }
}
export function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return (
    relative === ''
    || (!relative.startsWith(`..${path.sep}`)
      && relative !== '..'
      && !path.isAbsolute(relative))
  )
}
export function sensitive(file: string): boolean {
  return file
    .split(/[\\/]/)
    .some(
      part =>
        /^(?:\.git|\.weapp-agent|\.npmrc|\.env(?:\..+)?|.*\.(?:pem|key|p12))$/i.test(
          part,
        ) && part !== '.env.example',
    )
}
/** Canonicalize ancestors even for new files: symlink escapes cannot bypass the boundary. */
export async function safePath(root: string, file: string): Promise<string> {
  const canonicalRoot = await realpath(root)
  const target = path.resolve(canonicalRoot, file)
  if (
    !inside(canonicalRoot, target)
    || sensitive(path.relative(canonicalRoot, target))
  ) {
    throw new Error(
      `Path is outside the permitted workspace or is sensitive: ${file}`,
    )
  }
  let ancestor = target
  for (;;) {
    try {
      const resolved = await realpath(ancestor)
      if (
        !inside(canonicalRoot, resolved)
        || sensitive(path.relative(canonicalRoot, resolved))
      ) {
        throw new Error(`Symlink crosses the workspace boundary: ${file}`)
      }
      break
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      const parent = path.dirname(ancestor)
      if (parent === ancestor) {
        throw error
      }
      ancestor = parent
    }
  }
  try {
    if ((await lstat(target)).isSymbolicLink()) {
      throw new Error(`Editing or reading a symlink is not supported: ${file}`)
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
  return target
}
export async function requireTrust(context: ToolContext): Promise<void> {
  if (!context.trusted) {
    throw new ApprovalRequired(
      'Workspace is not trusted. Review its configuration, then run with --trust.',
    )
  }
}
export async function authorize(
  context: ToolContext,
  kind: 'command' | 'mcp' | 'publish' | 'external',
  summary: string,
  payload: unknown,
): Promise<void> {
  const accepted = await context.approve({
    kind,
    summary,
    fingerprint: hash(JSON.stringify(payload)),
  })
  if (!accepted) {
    throw new ApprovalRequired(`Approval required: ${summary}`)
  }
}
export async function fileHash(file: string): Promise<string> {
  return hash(await readFile(file, 'utf8'))
}

export function redactValue<T>(value: T, clean = redactor()): T {
  if (typeof value === 'string') {
    return clean(value) as T
  }
  if (Array.isArray(value)) {
    return value.map(v => redactValue(v, clean)) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redactValue(v, clean)]),
    ) as T
  }
  return value
}
