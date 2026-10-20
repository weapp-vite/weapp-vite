import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createVueLanguageService, normalizeFileName } from './languageService'
import { getGeneratedServiceScript } from './serviceScript'

const platformBridge = readFileSync(new URL('./fixtures/template-ref/platform.d.ts', import.meta.url), 'utf8')

describe('template ref per-file lib override', () => {
  it.each([
    { projectLib: 'wevu', fileLib: 'vue', expectedElement: 'HTMLMapElement' },
    { projectLib: 'vue', fileLib: 'wevu', expectedElement: 'TemplateRefValue' },
  ])('honors @lib $fileLib over project lib $projectLib for real map refs', ({ projectLib, fileLib, expectedElement }) => {
    const source = `<!-- @lib "${fileLib}" -->
<script setup lang="ts">
${fileLib === 'wevu' ? 'import type { TemplateRefValue } from \'wevu\'' : ''}
import { useTemplateRef } from '${fileLib}'
type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends (<T>() => T extends Right ? 1 : 2) ? true : false
type Assert<T extends true> = T
const mapRef = useTemplateRef('mapRef')
const contract: Assert<Equal<typeof mapRef.value, ${expectedElement} | null>> = true
void contract
</script>
<template><map ref="mapRef" /></template>`
    const root = normalizeFileName(fileURLToPath(new URL('./fixtures/template-ref', import.meta.url)))
    const fileName = `${root}/Parent.vue`
    const service = createVueLanguageService(new Map([
      [fileName, source],
      [`${root}/platform.d.ts`, platformBridge],
    ]), {
      lib: projectLib,
      compilerOptions: { skipLibCheck: false, types: [] },
    })
    try {
      expect(service.getSemanticDiagnostics(fileName)
        .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
        .map(diagnostic => ({
          code: diagnostic.code,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          start: diagnostic.start,
        }))).toEqual([])
      const generated = getGeneratedServiceScript(source, false, projectLib).generated
      if (fileLib === 'wevu') {
        expect(generated).toContain('MiniProgramTemplateRefElements')
      }
      else {
        expect(generated).not.toContain('MiniProgramTemplateRefElements')
      }
    }
    finally {
      service.dispose()
    }
  })
})
