import type { LanguagePlatform } from '../types'

export interface TemplateDirectives {
  if: string
  elif: string
  else: string
  for: string
  forItem: string
  forIndex: string
  key: string
}

export interface LanguageProfile {
  platform: LanguagePlatform
  support: 'core' | 'language-only'
  templateExtensions: readonly string[]
  styleExtensions: readonly string[]
  scriptExtensions: readonly string[]
  scriptModule: { tag: string, sourceAttribute: string, moduleAttribute: string }
  directives: TemplateDirectives
  events: { style: 'alipay' | 'bind' }
  rawTags: readonly string[]
  documentation: { url: string, version: 'unversioned', retrievedAt: string }[]
}
