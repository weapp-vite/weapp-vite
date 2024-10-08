import type { Entry, WeappViteConfig } from './types'
import process from 'node:process'
import { defaultExcluded } from '@/defaults'
import { findJsEntry } from '@/utils'
import { defu } from '@weapp-core/shared'
import { fdir as Fdir } from 'fdir'
import mm from 'micromatch'
import path from 'pathe'
import { getWxmlEntry, searchAppEntry } from './utils'

export function createFilter(include: string[], exclude: string[], options?: mm.Options) {
  const opts = defu<mm.Options, mm.Options[]>(options, {
    ignore: exclude,
  })

  return function (id: unknown | string) {
    if (typeof id !== 'string') {
      return false
    }
    if (/\0/.test(id)) {
      return false
    }

    return mm.isMatch(id as string, include, opts)
  }
}

export async function getEntries(options: { root?: string, srcRoot?: string, outDir?: string, relative?: boolean, subPackage?: WeappViteConfig['subPackage'] }) {
  // build.outDir
  const { root = process.cwd(), outDir = 'dist', relative, srcRoot = '', subPackage } = options

  function formatPath(to: string) {
    if (relative) {
      return path.relative(root, to)
    }
    return path.normalize(to)
  }

  // 单独打包分包的场景
  if (subPackage) {
    const subPackageRoot = subPackage.root ?? ''
    const filter = createFilter(
      [path.join(root, srcRoot, subPackageRoot, '**/*')],
      [
        ...defaultExcluded,
      ],
      { cwd: root },
    )

    const pageEntries: Entry[] = []
    const componentEntries: Entry[] = []
    const subPackageEntries: Entry[] = []

    if (subPackage.entry) {
      const p = path.join(root, subPackageRoot, subPackage.entry)
      const jsPath = await findJsEntry(p)
      if (jsPath) {
        subPackageEntries.push({
          deps: [],
          path: jsPath,
          type: 'subPackageEntry',
        })
      }
    }
    const files = await new Fdir().withFullPaths().filter(filter).crawl(path.join(root, subPackageRoot)).withPromise()

    for (const file of files) {
      if (/\.wxml$/.test(file)) {
        const entry = getWxmlEntry(file, formatPath)
        if (entry) {
          if (entry.type === 'component') {
            componentEntries.push(entry)
          }
          else if (entry.type === 'page') {
            pageEntries.push(entry)
          }
        }
      }
    }

    return {
      pages: pageEntries,
      components: componentEntries,
      subPackageEntries,
    }
  }
  // 打包主包的场景
  else {
    const appEntry = searchAppEntry({
      root: path.join(root, srcRoot),
      formatPath,
    })

    // TODO exclude 需要和 output 配套
    // const walkPathsSet = new Set<string>()
    if (appEntry) {
      const subPackageDeps = appEntry.deps.filter(x => x.type === 'subPackage')
      const filter = createFilter(
        [path.join(root, srcRoot, '**/*')],
        [
          ...defaultExcluded,
          path.join(root, `${outDir}/**`),
          ...subPackageDeps.map((x) => {
            return path.join(root, `${x.root}/**`)
          }),
        ],
        { cwd: root },
      )

      const pageEntries: Entry[] = []
      const componentEntries: Entry[] = []
      const files = await new Fdir().withFullPaths().filter(filter).crawl(path.join(root, srcRoot)).withPromise()
      for (const file of files) {
        if (/\.wxml$/.test(file)) {
          const entry = getWxmlEntry(file, formatPath)
          if (entry) {
            if (entry.type === 'component') {
              componentEntries.push(entry)
            }
            else if (entry.type === 'page') {
              pageEntries.push(entry)
            }
          }
        }
      }

      return {
        app: appEntry,
        pages: pageEntries,
        components: componentEntries,
        subPackages: subPackageDeps,

      }
    }
  }
}
