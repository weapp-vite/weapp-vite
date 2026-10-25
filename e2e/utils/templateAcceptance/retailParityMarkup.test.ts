import { describe, expect, it } from 'vitest'
import { projectRetailParityWxml, projectRetailTemplateWxml, retailNavigationNodes } from './retailParityMarkup'

const contract = { configuredTitle: '昵称', customTitle: '昵称', isTabRoute: false }
const business = '<view id="form"><input placeholder="请输入文字"/><text>业务内容</text></view>'
const feedback = '<miniprogram_npm overlay="" visible="false"/><miniprogram_npm popup="" name="dialog"><view>反馈内容</view></miniprogram_npm>'
const tabbar = '<custom-tab-bar><button>购物车</button></custom-tab-bar>'

function navigation(title = '昵称', action = '<view class="layout-navigation__button"><t-icon name="home"/></view>') {
  return `<view class="layout-navigation"><view class="layout-navigation__bar"><view class="layout-navigation__side layout-navigation__side--left">${
    action}</view><view class="layout-navigation__title">${title}</view><view class="layout-navigation__side"/></view></view>`
}

function document(body = business + feedback, nav = navigation(), shell = 'layouts default=""') {
  const tag = shell.split(' ')[0]
  return `<${shell}><view class="layout-default">${nav}${body}</view></${tag}>${tabbar}`
}

describe('retail parity navigation projection', () => {
  it('preserves a native document byte for byte without requiring a layout shell', () => {
    const source = `<view id="header"/><view id="body"/>${tabbar}`
    expect(projectRetailParityWxml(source)).toEqual({ comparisonWxml: source, navigation: null })
  })

  it('accepts the actual expanded TDesign home icon but rejects an unrelated label', () => {
    const rendered = '<view class="t-icon class t-class"><label class="t-icon-home t-icon-base"/></view>'
    expect(projectRetailTemplateWxml(document(business, navigation().replace('<t-icon name="home"/>', rendered)), contract).navigation.buttonCount).toBe(1)
    expect(() => projectRetailTemplateWxml(document(business, navigation().replace('<t-icon name="home"/>', rendered.replace('t-icon-home', 't-icon-chevron-left'))), contract)).toThrow('home action')
  })

  it('rejects class-matching unknown element tags instead of removing their contents', () => {
    expect(() => projectRetailTemplateWxml(document().replace('<view class="layout-default">', '<unknown class="layout-default">').replace('</view></layouts>', '</unknown></layouts>'), contract)).toThrow('unknown default layout element')
    expect(() => projectRetailTemplateWxml(document(business, navigation().replaceAll('view', 'unknown')), contract)).toThrow('unknown navigation element tags')
  })

  it('rejects meaningful text siblings that would otherwise disappear with the shell', () => {
    expect(() => projectRetailTemplateWxml(document().replace('<layouts default="">', '<layouts default="">unrelated business'), contract)).toThrow('nontransparent layout shells')
  })

  it('keeps every non-navigation sibling, feedback subtree and independent root in order', () => {
    const source = document()
    const result = projectRetailTemplateWxml(source, contract)

    expect(result.comparisonWxml).toBe(business + feedback + tabbar)
    expect(result.navigation).toMatchObject({ title: '昵称', titleSource: 'page-config', buttonCount: 1, nativeTitleUiObserved: false })
    expect(source).toBe(document())
  })

  it('keeps all business roots and slot wrappers without selecting the largest subtree', () => {
    const body = `<view id="first"/><slot><view id="second"/><view id="third"/></slot>${feedback}`
    expect(projectRetailTemplateWxml(document(body), contract).comparisonWxml).toBe(body + tabbar)
  })

  it('supports the explicit headless component tag and retains the page host', () => {
    const source = `<page>${document(business, navigation(), 'weapp-layout-default')}</page>`
    expect(projectRetailTemplateWxml(source, contract).comparisonWxml).toBe(`<page>${business}${tabbar}</page>`)
  })

  it('requires an exact nonempty configured title', () => {
    expect(() => projectRetailTemplateWxml(document(business, navigation('错误标题')), contract)).toThrow('title does not satisfy')
  })

  it('records a nonempty custom title without claiming native title UI coverage for empty configuration', () => {
    const result = projectRetailTemplateWxml(document(business, navigation('售后详情')), { ...contract, configuredTitle: '', customTitle: '售后详情' })
    expect(result.navigation).toMatchObject({ title: '售后详情', titleSource: 'custom-navigation-dom', configuredNativeTitle: '', nativeTitleUiObserved: false })
    expect(() => projectRetailTemplateWxml(document(business, navigation(' ')), { ...contract, configuredTitle: '' })).toThrow('title does not satisfy')
  })

  it('validates the absence of a home action on a freshly launched tab route', () => {
    expect(projectRetailTemplateWxml(document(business, navigation('昵称', '')), { ...contract, isTabRoute: true }).navigation.buttonCount).toBe(0)
    expect(() => projectRetailTemplateWxml(document(), { ...contract, isTabRoute: true })).toThrow('action does not match')
  })

  it('rejects a back action, missing button or unknown navigation child', () => {
    expect(() => projectRetailTemplateWxml(document(business, navigation().replace('name="home"', 'name="chevron-left"')), contract)).toThrow('home action')
    expect(() => projectRetailTemplateWxml(document(business, navigation('昵称', '')), contract)).toThrow('action does not match')
    expect(() => projectRetailTemplateWxml(document(business, navigation().replace('</view></view>', '<button>未知内容</button></view></view>')), contract)).toThrow()
  })

  it('rejects an unknown shell, duplicate shell and nested business shell', () => {
    expect(() => projectRetailTemplateWxml(document(business, navigation(), 'unknown-layout'), contract)).toThrow('unknown default layout shell')
    expect(() => projectRetailTemplateWxml(document() + document(), contract)).toThrow('exactly one default layout')
    expect(() => projectRetailTemplateWxml(`<view>${document()}</view>`, contract)).toThrow('document-level root')
  })

  it('rejects missing, duplicate and misplaced navigation', () => {
    expect(() => projectRetailTemplateWxml(document(business, ''), contract)).toThrow('exactly one custom navigation')
    expect(() => projectRetailTemplateWxml(document(business, navigation() + navigation()), contract)).toThrow('exactly one custom navigation')
    expect(() => projectRetailTemplateWxml(document(`<view>${navigation()}${business}</view>`, ''), contract)).toThrow('must belong')
  })

  it('rejects an empty business tree while preserving recognized feedback nodes for valid pages', () => {
    expect(() => projectRetailTemplateWxml(document(feedback), contract)).toThrow('empty business document')
    expect(() => projectRetailTemplateWxml(document(`<slot/>${feedback}`), contract)).toThrow('empty business document')
  })

  it('queries navigation across component boundaries while preserving visibility, exact title and button-scoped home icons', () => {
    expect(retailNavigationNodes(contract)).toEqual([
      { selector: '//*[contains(concat(" ", @class, " "), " layout-navigation ")]', query: 'xpath', count: 1, visible: true },
      { selector: '//*[contains(concat(" ", @class, " "), " layout-navigation__title ")]', query: 'xpath', count: 1, visible: true, text: '昵称' },
      { selector: '//*[contains(concat(" ", @class, " "), " layout-navigation__button ")]', query: 'xpath', count: 1, visible: true },
      { selector: '//*[contains(concat(" ", @class, " "), " layout-navigation__button ")]//*[contains(concat(" ", @class, " "), " t-icon-home ")]', query: 'xpath', count: 1 },
    ])
    expect(retailNavigationNodes({ ...contract, isTabRoute: true }).slice(2).map(node => node.count)).toEqual([0, 0])
    expect(retailNavigationNodes({ ...contract, configuredTitle: '' })[1]).not.toHaveProperty('text')
  })
})
