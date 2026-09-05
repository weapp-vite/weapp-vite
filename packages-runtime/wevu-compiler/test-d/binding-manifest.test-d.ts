import type {
  CompilerAppShell,
  CompilerPageLayoutPlan,
  CompileVueFileOptions,
  WevuBindingDependencyV1,
  WevuBindingKind,
  WevuBindingManifestV1,
  WevuBindingRecordV1,
  WevuBindingScopeV1,
  WevuBindingUpdateMode,
  WevuRuntimeBindingManifestV1,
} from '@wevu/compiler'
import { compileSfc, compileTemplate, createRuntimeBindingManifest } from '@wevu/compiler'
import { expectType } from 'tsd'

const templateResult = compileTemplate(
  '<view>{{ user.name }}</view>',
  '/project/src/pages/index.vue',
)

expectType<WevuBindingManifestV1>(templateResult.bindingManifest)
expectType<1>(templateResult.bindingManifest.version)
expectType<string>(templateResult.bindingManifest.sourceFile)
expectType<WevuBindingRecordV1[]>(templateResult.bindingManifest.bindings)
expectType<WevuBindingKind>(templateResult.bindingManifest.bindings[0]!.kind)
expectType<WevuBindingUpdateMode>(templateResult.bindingManifest.bindings[0]!.updateMode)
expectType<string | undefined>(templateResult.bindingManifest.bindings[0]!.sourceFile)
expectType<WevuBindingDependencyV1[]>(templateResult.bindingManifest.bindings[0]!.dependencies)
expectType<WevuBindingScopeV1[]>(templateResult.bindingManifest.bindings[0]!.scopes)
expectType<WevuRuntimeBindingManifestV1>(createRuntimeBindingManifest(templateResult.bindingManifest))

const pageLayout: CompilerPageLayoutPlan = {
  dynamicSwitch: false,
  currentLayout: {
    importPath: '/layouts/default',
    layoutName: 'default',
    tagName: 'layout-default',
  },
  layouts: [],
  dynamicPropKeys: [],
}
const appShell: CompilerAppShell = {
  importPath: '/app-shell',
  tagName: 'app-shell',
}
const options: CompileVueFileOptions = {
  autoSetDataPick: true,
  bindingManifestSourceFile: 'src/pages/index.vue',
  runtimeBindingManifest: 'diagnostic',
  pageLayout,
  appShell,
}

compileSfc('<template><view /></template>', '/project/src/pages/index.vue', options).then((result) => {
  expectType<WevuBindingManifestV1 | undefined>(result.bindingManifest)
})
