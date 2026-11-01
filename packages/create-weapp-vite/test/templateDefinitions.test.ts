import path from 'node:path'
import { fs } from '@weapp-core/shared/fs'
import { describe, expect, it } from 'vitest'
import { TemplateName } from '@/enums'
import { getTemplateDefinition, TEMPLATE_DEFINITIONS, TEMPLATE_DIR_MAP } from '@/templates'
import { DEFAULT_TEMPLATE_NAMES, TEMPLATE_DIR_MAP as SMOKE_TEMPLATE_DIR_MAP } from '../../../scripts/createWeappViteSmoke/templates.mjs'
import { Templates } from '../scripts/constants'

describe('template definitions', () => {
  it('keeps every public template available for generation, publication and smoke coverage', async () => {
    const templateNames = Object.values(TemplateName).toSorted()
    expect(TEMPLATE_DEFINITIONS.map(template => template.id).toSorted()).toEqual(templateNames)
    expect(Templates.map(template => template.dest).toSorted()).toEqual(templateNames)
    expect(DEFAULT_TEMPLATE_NAMES.toSorted()).toEqual(templateNames)
    expect(SMOKE_TEMPLATE_DIR_MAP).toEqual(TEMPLATE_DIR_MAP)

    for (const template of TEMPLATE_DEFINITIONS) {
      expect(template.label).not.toBe('')
      expect(['default', 'advanced', 'experimental']).toContain(template.visibility)
      expect(['native', 'wevu', 'react']).toContain(template.framework)
      expect(getTemplateDefinition(template.id)).toBe(template)
      expect(await fs.pathExists(path.resolve(import.meta.dirname, '../../../templates', template.directory, 'package.json'))).toBe(true)
    }
  })

  it('separates common app templates from advanced and experimental templates', () => {
    const names = (visibility: string) => TEMPLATE_DEFINITIONS
      .filter(template => template.visibility === visibility)
      .map(template => template.id)

    expect(names('default')).toEqual(['default', 'wevu', 'wevu-tdesign', 'tailwindcss', 'tdesign', 'vant'])
    expect(names('advanced')).toEqual(['plugin', 'lib'])
    expect(names('experimental')).toEqual(['multi-platform', 'multi-platform-sfc', 'react'])
  })

  it('identifies the framework profile independently of menu visibility', () => {
    expect(TEMPLATE_DEFINITIONS.filter(template => template.framework === 'wevu').map(template => template.id)).toEqual([
      'wevu',
      'wevu-tdesign',
      'plugin',
      'lib',
      'multi-platform-sfc',
    ])
    expect(getTemplateDefinition(TemplateName.react).framework).toBe('react')
    expect(getTemplateDefinition(TemplateName.default).framework).toBe('native')
  })
})
