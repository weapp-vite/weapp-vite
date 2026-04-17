import { describe, expect, it } from 'vitest'
import * as compiler from './index'

describe('compiler package entry', () => {
  it('re-exports the public compiler surface', () => {
    expect(compiler).toMatchObject({
      CLASS_STYLE_WXS_FILE: expect.any(String),
      CLASS_STYLE_WXS_MODULE: expect.any(String),
      RESERVED_VUE_COMPONENT_TAGS: expect.any(Set),
      builtinComponentsSet: expect.any(Set),
      buildClassStyleComputedCode: expect.any(Function),
      clearFileCaches: expect.any(Function),
      collectVueTemplateTags: expect.any(Function),
      compileJsxFile: expect.any(Function),
      compileSfc: expect.any(Function),
      compileStyle: expect.any(Function),
      compileTemplate: expect.any(Function),
      defaultMiniProgramTemplatePlatform: expect.any(Object),
      generateScopedId: expect.any(Function),
      getMiniProgramTemplatePlatform: expect.any(Function),
      isAutoImportCandidateTag: expect.any(Function),
      isBuiltinComponent: expect.any(Function),
      loadCache: expect.any(Object),
      transformScript: expect.any(Function),
      transformSfcScript: expect.any(Function),
    })
  })

  it('keeps aliased exports pointing to the same implementation', () => {
    expect(compiler.compileSfc).toBe(compiler.compileVueFile)
    expect(compiler.compileStyle).toBe(compiler.compileVueStyleToWxss)
    expect(compiler.compileTemplate).toBe(compiler.compileVueTemplateToWxml)
    expect(compiler.defaultMiniProgramTemplatePlatform).toBe(compiler.getDefaultMiniProgramTemplatePlatform())
    expect(compiler.transformSfcScript).toBe(compiler.transformScript)
  })
})
