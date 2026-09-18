import type { WevuBindingManifestV1 } from '../../../../types/bindingManifest'
import type { ScopedSlotComponentAsset } from './types'
import { WEVU_SLOT_OWNER_KEY } from '@weapp-core/constants'
import { isBindingManifestComplete, markBindingManifestIncomplete } from './bindingManifest'

/** 将插槽依赖的 owner 数据纳入父组件快照，避免自动裁剪丢失子模板输入。 */
export function retainScopedSlotOwnerBindings(manifest: WevuBindingManifestV1, slots: ScopedSlotComponentAsset[]) {
  const retained = new Set<string>()
  for (const slot of slots) {
    if (!isBindingManifestComplete(slot.bindingManifest)) {
      markBindingManifestIncomplete(manifest)
    }
    for (const binding of slot.bindingManifest.bindings) {
      for (const dependency of binding.dependencies ?? []) {
        if (dependency.root !== WEVU_SLOT_OWNER_KEY) {
          continue
        }
        const prefix = `${WEVU_SLOT_OWNER_KEY}.`
        if (!dependency.path?.startsWith(prefix)) {
          // 动态 owner 访问无法静态枚举，必须保留完整快照。
          markBindingManifestIncomplete(manifest)
          continue
        }
        const ownerPath = dependency.path.slice(prefix.length)
        const root = /^[A-Z_$][\w$]*/i.exec(ownerPath)?.[0]
        if (!root || retained.has(ownerPath)) {
          continue
        }
        retained.add(ownerPath)
        manifest.bindings.push({
          id: `b${manifest.bindings.length}`,
          kind: 'component-prop',
          outputPath: ownerPath,
          sourceRoots: [root],
          sourcePaths: [ownerPath],
          dependencies: [{ root, path: ownerPath, updateMode: 'exact-path' }],
          scopes: [{ kind: 'root', depth: 0 }],
          updateMode: 'exact-path',
          sourceLocation: binding.sourceLocation,
        })
      }
    }
  }
}
