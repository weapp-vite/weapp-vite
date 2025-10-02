import type { CompilerContext } from '../../../context'
import { performance } from 'node:perf_hooks'

export function createTemplateScanner(
  wxmlService: CompilerContext['wxmlService'],
  debug?: (...args: any[]) => void,
) {
  return async function scanTemplateEntry(templateEntry: string) {
    const start = performance.now()
    const wxmlToken = await wxmlService.scan(templateEntry)

    if (wxmlToken) {
      const { components } = wxmlToken
      wxmlService.setWxmlComponentsMap(templateEntry, components)
    }

    debug?.(`scanTemplateEntry ${templateEntry} 耗时 ${(performance.now() - start).toFixed(2)}ms`)
  }
}
