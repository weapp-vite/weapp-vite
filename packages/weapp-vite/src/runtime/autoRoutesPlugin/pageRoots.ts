import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { toPosixPath } from '../../utils/path'
import { isAutoRoutesGeneratedDirectoryName } from './generatedPaths'

const SKIPPED_DIRECTORIES = new Set(['.git', '.husky', '.idea', '.turbo'])

interface DirentLike {
  name: string
  isDirectory: () => boolean
}

export function hasNestedPagesRoot(
  root: string,
  discoveredPagesRoots: Iterable<string>,
) {
  const normalizedRoot = toPosixPath(root)
  return [...discoveredPagesRoots].some((pagesRoot) => {
    const normalizedPagesRoot = toPosixPath(pagesRoot)
    return normalizedPagesRoot === `${normalizedRoot}/pages`
      || normalizedPagesRoot.startsWith(`${normalizedRoot}/pages/`)
  })
}

export function classifyPagesRootEntry(
  current: string,
  entry: DirentLike,
) {
  if (!entry.isDirectory()) {
    return undefined
  }

  if (SKIPPED_DIRECTORIES.has(entry.name) || isAutoRoutesGeneratedDirectoryName(entry.name)) {
    return undefined
  }

  const nextPath = path.join(current, entry.name)
  return entry.name === 'pages'
    ? { pageRoot: nextPath }
    : { nextPath }
}

export async function discoverPagesRootsWithReaddir(
  root: string,
  readdir: (dir: string) => Promise<DirentLike[]>,
) {
  let queue = [root]
  const pagesRoots = new Set<string>()

  while (queue.length > 0) {
    const currentBatch = queue
    queue = []
    const entriesBatch = await Promise.all(currentBatch.map(async (current) => {
      try {
        return {
          current,
          entries: await readdir(current),
        }
      }
      catch {
        return {
          current,
          entries: [],
        }
      }
    }))

    for (const { current, entries } of entriesBatch) {
      for (const entry of entries) {
        const classified = classifyPagesRootEntry(current, entry)
        if (!classified) {
          continue
        }

        if ('pageRoot' in classified) {
          if (classified.pageRoot) {
            pagesRoots.add(classified.pageRoot)
          }
          continue
        }

        queue.push(classified.nextPath)
      }
    }
  }

  return pagesRoots
}

export async function discoverPagesRoots(root: string) {
  return await discoverPagesRootsWithReaddir(
    root,
    async dir => await fs.readdir(dir, { withFileTypes: true }),
  )
}

export function buildDefaultSearchRoots(
  absoluteSrcRoot: string,
  discoveredPagesRoots: Iterable<string>,
  subPackageRoots?: Iterable<string>,
) {
  const roots: string[] = []
  const discoveredRoots = [...discoveredPagesRoots]

  if (discoveredRoots.length > 0) {
    roots.push(...discoveredRoots)
  }
  else {
    roots.push(absoluteSrcRoot)
  }

  for (const root of subPackageRoots ?? []) {
    if (!root) {
      continue
    }

    const absoluteRoot = path.resolve(absoluteSrcRoot, root)

    if (!hasNestedPagesRoot(absoluteRoot, discoveredRoots)) {
      roots.push(absoluteRoot)
    }
  }

  return roots
}

export async function resolveDefaultSearchRoots(
  absoluteSrcRoot: string,
  subPackageRoots?: Iterable<string>,
) {
  const discoveredPagesRoots = await discoverPagesRoots(absoluteSrcRoot)

  return buildDefaultSearchRoots(absoluteSrcRoot, discoveredPagesRoots, subPackageRoots)
}
