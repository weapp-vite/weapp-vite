import type { CompilerContext, MutableCompilerContext } from './CompilerContext'
import { createAutoImportServicePlugin } from '../runtime/autoImportPlugin'
import { createAutoRoutesServicePlugin } from '../runtime/autoRoutesPlugin'
import { createBuildServicePlugin } from '../runtime/buildPlugin'
import { createConfigServicePlugin } from '../runtime/configPlugin'
import { createJsonServicePlugin } from '../runtime/jsonPlugin'
import { createNpmServicePlugin } from '../runtime/npmPlugin'
import { createRuntimeState } from '../runtime/runtimeState'
import { createScanServicePlugin } from '../runtime/scanPlugin'
import { createWatcherServicePlugin } from '../runtime/watcherPlugin'
import { createWebServicePlugin } from '../runtime/webPlugin'
import { createWxmlServicePlugin } from '../runtime/wxmlPlugin'

export function createCompilerContextInstance(): CompilerContext {
  const context = {
    runtimeState: createRuntimeState(),
  } as MutableCompilerContext

  const runtimePlugins = [
    createConfigServicePlugin(context),
    createWatcherServicePlugin(context),
    createWxmlServicePlugin(context),
    createJsonServicePlugin(context),
    createScanServicePlugin(context),
    createAutoRoutesServicePlugin(context),
    createAutoImportServicePlugin(context),
    createNpmServicePlugin(context),
    createBuildServicePlugin(context),
    createWebServicePlugin(context),
  ]

  Object.defineProperty(context, Symbol.for('weapp-runtime:plugins'), {
    configurable: false,
    enumerable: false,
    writable: false,
    value: runtimePlugins,
  })

  return context as CompilerContext
}
