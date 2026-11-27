import path from 'node:path'
import { syncManagedTsconfigBootstrapFilesRecursively } from '../../../vitest.globalSetup.mjs'
import { main as generateTemplateCatalog } from './generate-template-catalog'
import { main as syncTemplates } from './shared'
import { prepareVitePlusTemplates } from './vitePlusTemplates'

await generateTemplateCatalog()
await syncTemplates()
await prepareVitePlusTemplates()
await syncManagedTsconfigBootstrapFilesRecursively(path.resolve(import.meta.dirname, '../templates'))
