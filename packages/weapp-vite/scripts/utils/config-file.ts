import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'

const CONFIG_FILE_CANDIDATES = [
  'weapp-vite.config.ts',
  'vite.config.ts',
] as const

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

export async function listConfigFileCandidates(projectRoot: string) {
  const entries = await Promise.all(
    CONFIG_FILE_CANDIDATES.map(async (basename) => {
      const filePath = path.join(projectRoot, basename)
      return (await pathExists(filePath)) ? filePath : undefined
    }),
  )

  return entries.filter((value): value is string => Boolean(value))
}

export async function patchProjectConfigFile(
  projectRoot: string,
  updater: (content: string, filePath: string) => string,
  options: {
    errorMessage: string
    allowUnchanged?: boolean
  },
) {
  const candidates = await listConfigFileCandidates(projectRoot)
  let fallback: { content: string, filePath: string } | undefined

  for (const filePath of candidates) {
    const content = await readFile(filePath, 'utf8')
    fallback ??= { content, filePath }
    const nextContent = updater(content, filePath)

    if (nextContent === content) {
      continue
    }

    await writeFile(filePath, nextContent, 'utf8')
    return {
      changed: true,
      filePath,
    }
  }

  if (options.allowUnchanged && fallback) {
    return {
      changed: false,
      filePath: fallback.filePath,
    }
  }

  throw new Error(`${options.errorMessage}: ${fallback?.filePath ?? path.join(projectRoot, CONFIG_FILE_CANDIDATES[0])}`)
}
