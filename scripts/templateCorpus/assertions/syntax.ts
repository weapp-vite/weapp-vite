/* eslint-disable no-template-curly-in-string -- 矩阵保留模板字符串插值的原文供被测词法器读取。 */
import type { CorpusProfile } from '../types'
import type { TemplateApi } from './types'
import { assertTemplate, CorpusAssertionError } from './index'

const directives: Record<string, [string, string, string]> = {
  weapp: ['wx:if', 'wx:for', 'bind:tap'],
  alipay: ['a:if', 'a:for', 'onTap'],
  swan: ['s-if', 's-for', 'bindtap'],
  tt: ['tt:if', 'tt:for', 'bindtap'],
  jd: ['jd:if', 'jd:for', 'bindtap'],
  xhs: ['xhs:if', 'xhs:for', 'bindtap'],
  qq: ['qq:if', 'qq:for', 'bindtap'],
  ks: ['ks:if', 'ks:for', 'bindtap'],
  ty: ['ty:if', 'ty:for', 'bindtap'],
  ascf: ['has:if', 'has:for', 'bindtap'],
  harmony: ['if', 'for', 'onclick'],
}

export interface SyntaxCase { name: string, source: string, expectation: 'valid' | 'invalid', diagnosticCodes?: string[] }

/** 这里只承诺词法保留；指令运行语义仍由真实上游和宿主语料证明。 */
export function syntaxCases(profile: CorpusProfile): SyntaxCase[] {
  const [condition, loop, event] = directives[profile.platform] ?? ['if', 'for', 'on:tap']
  const cases: SyntaxCase[] = [
    { name: 'platform-directives-events', source: `<view ${condition}="{{visible}}" ${loop}="{{items}}" ${event}="tap" capture-bind:tap="capture" catch:touchstart="stop"/>`, expectation: 'valid' },
    { name: 'template-import-include-slot', source: '<import src="./a"/><include src="./b"/><template name="card"><slot name="body"/></template><template is="card" data="{{...item}}"/>', expectation: 'valid' },
    { name: 'attribute-forms-duplicates-entities', source: '<view bare empty="" single=\'one &amp; two\' unquoted=ok duplicate="a" duplicate="b" data-😀="unicode"/>', expectation: 'valid' },
    { name: 'unicode-crlf-ranges', source: '😀\r\n<view title="中文😀">e\u0301\r\n{{value}}</view>\u2028', expectation: 'valid' },
    { name: 'binding-nested-strings-regexp-template', source: '<view>{{ ({ value: `prefix${ /[}]/.test(value) ? "}}" : "<fake/>" }` }).value }}</view>', expectation: 'valid' },
    { name: 'comment-cdata-declaration', source: '<?xml version="1.0"?><!DOCTYPE view [<!ENTITY example "<fake/>">]><!--<fake/>--><![CDATA[{{opaque}} <fake/>]]><view/>', expectation: 'valid' },
    { name: 'diagnostic-pairing', source: '<view><text/></wrong>', expectation: 'invalid', diagnosticCodes: ['template/mismatched-tag'] },
    { name: 'diagnostic-interpolation', source: '<view>{{(value}}</view>', expectation: 'invalid', diagnosticCodes: ['template/invalid-interpolation'] },
    { name: 'diagnostic-attribute', source: '<view title="unterminated', expectation: 'invalid', diagnosticCodes: ['template/invalid-syntax'] },
  ]
  for (const tag of profile.rawTags) {
    cases.push({ name: `raw-${tag}-pseudo-markup`, source: `<${tag} module="test">const fake="</${tag}><fake/>"; const regexp=/<fake[>]/; module.exports={};</${tag}><view/>`, expectation: 'valid' })
    cases.push({ name: `raw-${tag}-external-module`, source: `<${tag} module="test" src="./module.js"/><view/>`, expectation: 'valid' })
  }
  cases.push({ name: 'custom-component-is-not-script', source: '<custom-script><view/></custom-script>', expectation: 'valid' })
  return cases
}

export function runSyntaxMatrix(api: TemplateApi, profiles: readonly CorpusProfile[]) {
  const scenarios: Record<string, string[]> = {}
  for (const profile of profiles) {
    scenarios[profile.id] = []
    for (const testCase of syntaxCases(profile)) {
      assertTemplate(api, testCase.source, { platform: profile.parserPlatform, syntax: profile.syntax, rawTags: profile.rawTags }, testCase.expectation, testCase.diagnosticCodes)
      scenarios[profile.id]!.push(testCase.name)
    }
  }
  return scenarios
}

/** 正式报告完整执行矩阵，单例失败不能掩盖后续平台的证据。 */
export function collectSyntaxMatrix(api: TemplateApi, profiles: readonly CorpusProfile[]) {
  const scenarios: Record<string, string[]> = {}
  const failures: Array<{ profileId: string, name: string, source: string, stage: string, message: string }> = []
  for (const profile of profiles) {
    scenarios[profile.id] = []
    for (const testCase of syntaxCases(profile)) {
      try {
        assertTemplate(api, testCase.source, { platform: profile.parserPlatform, syntax: profile.syntax, rawTags: profile.rawTags }, testCase.expectation, testCase.diagnosticCodes)
        scenarios[profile.id]!.push(testCase.name)
      }
      catch (error) {
        failures.push({ profileId: profile.id, name: testCase.name, source: testCase.source, stage: error instanceof CorpusAssertionError ? error.stage : 'exception', message: String(error) })
      }
    }
  }
  return { accepted: failures.length === 0, scenarios, failures }
}
