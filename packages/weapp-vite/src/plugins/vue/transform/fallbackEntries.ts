import type { CompilerContext } from '../../../context'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { resolveSubPackageIndependent } from '../../../runtime/appConfig'
import { isPathInside, normalizeRoot } from '../../../utils/path'
import { collectVuePages } from './collectVuePages'

interface FallbackSubPackage {
  root?: string
  pages?: string[]
  independent?: boolean
}

interface FallbackPageRegistry {
  pages?: string[]
  subPackages?: FallbackSubPackage[]
  subpackages?: FallbackSubPackage[]
}

export async function collectFallbackPageEntryIds(
  configService: CompilerContext['configService'],
  scanService: CompilerContext['scanService'],
): Promise<Set<string>> {
  const currentRoot = normalizeRoot(configService.currentSubPackageRoot ?? '')
  let appJson: FallbackPageRegistry | undefined = scanService.appEntry?.json
  if (!appJson && currentRoot) {
    // 独立构建的扫描状态尚未初始化时，读取本轮源码注册表，不能借用旧产物中的主包页面。
    appJson = (await scanService.loadAppEntry()).json
  }
  if (!appJson) {
    const appJsonPath = path.join(configService.cwd, 'dist', 'app.json')
    try {
      const appJsonContent = await fs.readFile(appJsonPath, 'utf-8')
      const parsed: unknown = JSON.parse(appJsonContent)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        appJson = parsed as FallbackPageRegistry
      }
    }
    catch {
      // 忽略
    }
  }

  const subPackages = [...appJson?.subPackages ?? [], ...appJson?.subpackages ?? []]
  const independentRoots = subPackages
    .filter(subPackage => resolveSubPackageIndependent(
      subPackage,
      configService.weappViteConfig?.subPackages?.[normalizeRoot(subPackage.root ?? '')],
    ))
    .map(subPackage => normalizeRoot(subPackage.root ?? ''))
    .filter(Boolean)
  const belongsToCurrentOutput = (file: string) => currentRoot
    ? isPathInside(path.join(configService.absoluteSrcRoot, currentRoot), file)
    : independentRoots.every(root => !isPathInside(path.join(configService.absoluteSrcRoot, root), file))

  const collectedEntries = new Set<string>()
  const addEntry = (entry: string) => {
    const file = path.join(configService.absoluteSrcRoot, entry)
    if (belongsToCurrentOutput(file)) {
      collectedEntries.add(file)
    }
  }
  if (!currentRoot) {
    appJson?.pages?.forEach(addEntry)
  }
  for (const subPackage of subPackages) {
    const root = normalizeRoot(subPackage.root ?? '')
    if (!root || (currentRoot ? root !== currentRoot : independentRoots.includes(root))) {
      continue
    }
    subPackage.pages?.forEach(page => addEntry(path.join(root, page)))
  }

  if (!currentRoot && !appJson) {
    // 仅缺少注册表时保留历史发现；结果已去除 Vue/TSX/JSX 后缀，不能再次截断文件身份。
    const extraVueFiles = await collectVuePages(path.join(configService.absoluteSrcRoot, 'pages'))
    extraVueFiles.filter(belongsToCurrentOutput).forEach(file => collectedEntries.add(file))
  }

  return collectedEntries
}
