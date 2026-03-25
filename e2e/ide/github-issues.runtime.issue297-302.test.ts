import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  readClassName,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / issue-297-302', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #297: compiles and renders complex call expressions', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 complex call expressions')
    expect(issuePageWxml).toContain('Case A · v-bind 调用表达式')
    expect(issuePageWxml).toContain('Case B · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case C · 多参数调用（含激活项）')
    expect(issuePageWxml).toContain('Case A(v-bind):')
    expect(issuePageWxml).toContain('Case B(v-if/v-for):')
    expect(issuePageWxml).toContain('Case C(多参数):')
    expect(issuePageWxml).toContain('新增列表项')
    expect(issuePageWxml).toContain('重置列表')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-title="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-hello="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/\{\{__wv_bind_\d+\[[^\]]+\]\}\}/)
    expect(issuePageWxml).not.toContain('sayHello(')
    const bindTokens = issuePageWxml.match(/__wv_bind_\d+/g) ?? []
    expect(new Set(bindTokens).size).toBeGreaterThanOrEqual(5)

    expect(issuePageJs).toMatch(/sayHello\)\(1,/)
    expect(issuePageJs).toContain('dasd')
    expect(issuePageJs).toContain('this.sayHello')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-297/index', 'Hello-1-root-dasd')
      if (!issuePage) {
        throw new Error('Failed to launch issue-297 page')
      }
      const initialRenderedWxml = await readPageWxml(issuePage)
      expect(initialRenderedWxml).toContain('Hello-1-root-dasd')
      expect(initialRenderedWxml).toContain('Hello-1-Alpha-dasd')
      expect(initialRenderedWxml).toContain('Hello-1-Beta-dasd')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.root).toBe('Hello-1-root-dasd')
      expect(runtimeResult?.rendered).toEqual([
        'Hello-1-Alpha-dasd',
        'Hello-1-Beta-dasd',
      ])
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #297: setup method call variants remain stable across expression contexts', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 setup method call variants')
    expect(issuePageWxml).toContain('Case A · 插值调用 + 同级静态文本 + 同级元素')
    expect(issuePageWxml).toContain('Case B · v-bind 多参数调用')
    expect(issuePageWxml).toContain('Case C · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case D · 成员调用 / 模板字符串 / 三元表达式')
    expect(issuePageWxml).toContain('Case E · 可选调用 + 空值兜底')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-inline="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-multi="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-label="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-loop="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-member="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-template="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-ternary="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-wrap="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-optional="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).not.toContain('getCase()')
    expect(issuePageWxml).not.toContain('sayCase(')
    expect(issuePageWxml).not.toContain('getOptionalInvoker?.(')

    expect(issuePageJs).toContain('this.getCase')
    expect(issuePageJs).toContain('this.sayCase')
    expect(issuePageJs).toContain('this.getRows')
    expect(issuePageJs).toContain('this.getOptionalInvoker')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-297-setup-method-calls/index', 'bind-Alpha-dasd')
      if (!issuePage) {
        throw new Error('Failed to launch issue-297-setup-method-calls page')
      }

      const initialRenderedWxml = await readPageWxml(issuePage)
      expect(initialRenderedWxml).toContain('123')
      expect(initialRenderedWxml).toContain('11')
      expect(initialRenderedWxml).toContain('bind-Alpha-dasd')
      expect(initialRenderedWxml).toContain('data-loop="loop-Alpha-tail"')
      expect(initialRenderedWxml).toContain('data-member="MEMBER-ALPHA-TAIL"')
      expect(initialRenderedWxml).toContain('data-template="P-123"')
      expect(initialRenderedWxml).toContain('data-ternary="ternary-row-0-dasd"')
      expect(initialRenderedWxml).toContain('data-wrap="[wrap-row-0-tail]"')
      expect(initialRenderedWxml).toContain('data-optional="Maybe-row-0"')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.inlineValue).toBe('123')
      expect(runtimeResult?.bindValue).toBe('bind-Alpha-dasd')
      expect(runtimeResult?.loopValues).toEqual([
        'loop-Alpha-tail',
        'loop-Beta-tail',
      ])
      expect(runtimeResult?.templateLiteralValue).toBe('P-123')
      expect(runtimeResult?.memberValue).toBe('MEMBER-ALPHA-TAIL')
      expect(runtimeResult?.ternaryValue).toBe('ternary-row-0-dasd')
      expect(runtimeResult?.optionalValue).toBe('Maybe-row-0')

      await issuePage.callMethod('toggleOptionalInvoker')
      await issuePage.waitFor(300)
      const optionalDisabledWxml = await readPageWxml(issuePage)
      expect(optionalDisabledWxml).toContain('data-optional="none"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #302: updates v-for class bindings with active state changes', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-302/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-302/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-302 v-for class binding update')
    expect(issuePageWxml).toContain('active: {{active}}')
    expect(issuePageWxml).toContain('wx:for="{{tabs}}"')
    expect(issuePageWxml).toMatch(/class="\{\{__wv_cls_\d+\[(?:__wv_index_0|index)\]\}\}"/)
    expect(issuePageJs).toContain('setActive')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-302/index', 'issue-302 v-for class binding update')
      if (!issuePage) {
        throw new Error('Failed to launch issue-302 page')
      }

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.active).toBe('a')
      expect(await issuePage.data('active')).toBe('a')
      expect(await issuePage.data('__wv_cls_0')).toEqual([
        'issue302-item issue302-item-a issue302-item-active',
        'issue302-item issue302-item-b issue302-item-inactive',
        'issue302-item issue302-item-c issue302-item-inactive',
      ])
      expect(await readClassName(issuePage, '.issue302-item-a')).toContain('issue302-item-active')
      expect(await readClassName(issuePage, '.issue302-item-b')).toContain('issue302-item-inactive')
      expect(await readClassName(issuePage, '.issue302-item-c')).toContain('issue302-item-inactive')

      await issuePage.callMethod('setActive', 'b')
      await issuePage.waitFor(240)
      const switchedToBRuntime = await issuePage.callMethod('_runE2E')
      expect(switchedToBRuntime?.ok).toBe(true)
      expect(switchedToBRuntime?.active).toBe('b')
      expect(await issuePage.data('active')).toBe('b')

      await issuePage.callMethod('setActive', 'c')
      await issuePage.waitFor(240)
      const switchedToCRuntime = await issuePage.callMethod('_runE2E')
      expect(switchedToCRuntime?.ok).toBe(true)
      expect(switchedToCRuntime?.active).toBe('c')
      expect(await issuePage.data('active')).toBe('c')
      expect(await readClassName(issuePage, '.issue302-item-c')).toContain('issue302-item-active')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.active).toBe('c')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
