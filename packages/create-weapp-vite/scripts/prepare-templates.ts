import { main as generateTemplateCatalog } from './generate-template-catalog'
import { main as syncTemplates } from './shared'
import { prepareVitePlusTemplates } from './vitePlusTemplates'

await generateTemplateCatalog()
await syncTemplates()
await prepareVitePlusTemplates()
