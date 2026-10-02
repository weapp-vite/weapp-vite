import type { VueVirtualCode } from '@vue/language-core'
import { createVueLanguagePlugin } from '@vue/language-core'
import ts from 'typescript'
import { createTestVueCompilerOptions } from './compilerOptions'

export function getGeneratedServiceScript(source: string, skipTemplateCodegen = false) {
  const languagePlugin = createVueLanguagePlugin<string>(
    ts,
    {},
    createTestVueCompilerOptions('wevu', skipTemplateCodegen),
    id => id,
  )
  const root = languagePlugin.createVirtualCode?.('fixture.vue', 'vue', ts.ScriptSnapshot.fromString(source), {
    getAssociatedScript: () => undefined,
  }) as VueVirtualCode | undefined
  expect(root).toBeTruthy()

  const serviceScript = languagePlugin.typescript?.getServiceScript(root!)
  expect(serviceScript).toBeTruthy()
  const generated = serviceScript!.code.snapshot.getText(0, serviceScript!.code.snapshot.getLength())
  const templateStart = source.indexOf('<template')
  const templateEnd = source.lastIndexOf('</template>')
  const templateReferences = serviceScript!.code.mappings.flatMap((mapping) => {
    if (!mapping.data.navigation || !mapping.data.verification) {
      return []
    }
    return mapping.sourceOffsets.flatMap((offset, index) => {
      if (offset < templateStart || offset >= templateEnd) {
        return []
      }
      const original = source.slice(offset, offset + mapping.lengths[index]!)
      const generatedOffset = mapping.generatedOffsets[index]!
      const generatedLength = mapping.generatedLengths?.[index] ?? mapping.lengths[index]!
      const reference = generated.slice(generatedOffset, generatedOffset + generatedLength)
      return original === reference ? [reference] : []
    })
  })

  return { languagePlugin, root: root!, generated, templateReferences }
}
