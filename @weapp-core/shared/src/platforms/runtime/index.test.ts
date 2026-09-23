import { describe, expect, it } from 'vitest'
import { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from '../descriptors'
import { getMiniProgramDirectivePrefix, getMiniProgramRuntimeDescriptor, getSupportedMiniProgramDirectivePrefixes, MINI_PROGRAM_RUNTIME_DESCRIPTORS } from './index'

describe('runtime-only platform contracts', () => {
  it('shares runtime metadata and aliases with the build-time platform registry', () => {
    expect(MINI_PROGRAM_RUNTIME_DESCRIPTORS.map(descriptor => descriptor.id)).toEqual(MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => descriptor.id))
    for (const descriptor of MINI_PROGRAM_PLATFORM_DESCRIPTORS) {
      const runtime = getMiniProgramRuntimeDescriptor(descriptor.id)
      expect(runtime.runtime).toBe(descriptor.runtime)
      expect(runtime.aliases).toBe(descriptor.aliases)
      expect(Object.keys(runtime).sort()).toEqual(['aliases', 'id', 'runtime'])
    }
  })

  it('shares template prefixes with the build registry without requiring its metadata', () => {
    for (const descriptor of MINI_PROGRAM_PLATFORM_DESCRIPTORS) {
      expect(getMiniProgramDirectivePrefix(descriptor.id)).toBe(descriptor.wxml?.directivePrefix)
    }
    expect(getMiniProgramDirectivePrefix()).toBe('wx')
    expect(getSupportedMiniProgramDirectivePrefixes()).toEqual(['wx', 'a', 's', 'tt'])
  })
})
