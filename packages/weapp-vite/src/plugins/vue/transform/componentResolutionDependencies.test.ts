import type { CompileVueFileOptions, VueTransformResult } from 'wevu/compiler'
import { WEVU_CLASS_STYLE_RUNTIME_MODULE } from '@weapp-core/constants'
import { expect, it } from 'vitest'
import { recordSfcBlockSource } from '../../utils/sfcTemplateDependencies'
import { applyComponentResolutionDependencies } from './componentResolutionDependencies'

it('rebases native dependencies in owner and scoped-slot outputs while retaining compiler-owned WXS', () => {
  const filename = '/project/src/pages/card/index.vue'
  const options: CompileVueFileOptions = { sfcSrc: {} }
  recordSfcBlockSource(options.sfcSrc!, './parts/body.html', filename)
  const template = [
    '<include src="./included.wxml" />',
    '<wxs module="authored" src="../../runtime.wxs" />',
    `<wxs module="${WEVU_CLASS_STYLE_RUNTIME_MODULE}" src="../../runtime.wxs" />`,
  ].join('\n')
  const result = {
    template,
    classStyleWxs: true,
    bindingManifest: { sourceFile: './parts/body.html' },
    scopedSlotComponents: [{ template, classStyleWxs: true }],
  } as VueTransformResult

  applyComponentResolutionDependencies(result, options, filename)

  const expected = [
    '<include src="./parts/included.wxml" />',
    '<wxs module="authored" src="../runtime.wxs" />',
    `<wxs module="${WEVU_CLASS_STYLE_RUNTIME_MODULE}" src="../../runtime.wxs" />`,
  ].join('\n')
  expect(result.template).toBe(expected)
  expect(result.scopedSlotComponents?.[0].template).toBe(expected)
})

it('keeps the original dependency base when the result has no external template identity', () => {
  const result = { template: '<include src="./included.wxml" />' } as VueTransformResult
  applyComponentResolutionDependencies(result, { sfcSrc: {} }, '/project/src/pages/index.vue')
  expect(result.template).toBe('<include src="./included.wxml" />')
})
