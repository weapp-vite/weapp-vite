import type { MutableCompilerContext } from '../../../context'
import type { SubPackage, SubPackageMetaValue } from '../../../types'
import { normalizeRoot } from '../../../utils/path'
import { requireConfigService } from '../../utils/requireConfigService'
import { normalizeSubPackageStyleEntries } from '../styleEntries'
import { resolveSubPackageEntries } from '../subpackages'

export function loadSubPackages(ctx: MutableCompilerContext) {
  const scanState = ctx.runtimeState.scan
  const { subPackageMap, independentSubPackageMap, independentDirtyRoots } = scanState
  const configService = requireConfigService(ctx, '扫描分包前必须初始化 configService。')
  const json = scanState.appEntry?.json

  if (scanState.isDirty || subPackageMap.size === 0) {
    subPackageMap.clear()
    independentSubPackageMap.clear()
    if (scanState.isDirty) {
      independentDirtyRoots.clear()
    }

    if (json) {
      const independentSubPackages = [
        ...json.subPackages ?? [],
        ...json.subpackages ?? [],
      ] as SubPackage[]
      for (const subPackage of independentSubPackages) {
        const normalizedRoot = subPackage.root ? normalizeRoot(subPackage.root) : undefined
        const subPackageConfig = normalizedRoot ? configService.weappViteConfig?.subPackages?.[normalizedRoot] : undefined
        const npmSubPackageConfig = normalizedRoot ? configService.weappViteConfig?.npm?.subPackages?.[normalizedRoot] : undefined
        const resolvedSubPackage = {
          ...subPackage,
          ...(normalizedRoot ? { root: normalizedRoot } : {}),
          dependencies: npmSubPackageConfig?.dependencies,
          inlineConfig: subPackageConfig?.inlineConfig,
        }
        const meta: SubPackageMetaValue = {
          subPackage: resolvedSubPackage,
          entries: resolveSubPackageEntries(resolvedSubPackage),
        }
        meta.autoImportComponents = subPackageConfig?.autoImportComponents
        meta.styleEntries = normalizeSubPackageStyleEntries(
          subPackageConfig?.styles,
          resolvedSubPackage,
          configService,
        )
        meta.watchSharedStyles = subPackageConfig?.watchSharedStyles ?? true
        if (normalizedRoot) {
          subPackageMap.set(normalizedRoot, meta)
          if (subPackage.independent) {
            independentSubPackageMap.set(normalizedRoot, meta)
            if (scanState.isDirty) {
              independentDirtyRoots.add(normalizedRoot)
            }
          }
        }
      }
    }

    scanState.isDirty = false
  }
  else {
    for (const meta of subPackageMap.values()) {
      meta.entries = resolveSubPackageEntries(meta.subPackage)
    }
  }

  if (scanState.appEntry) {
    return [...subPackageMap.values()]
  }

  throw new Error(`在 ${configService.absoluteSrcRoot} 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径  `)
}
