import type { DomNodeExpectation } from '../domAcceptance/types'
import { DomUtils, parseDocument } from 'htmlparser2'
import { xpathClass } from '../../ide/tdesignDom'

type MarkupNode = ReturnType<typeof parseDocument>['children'][number]
type MarkupElement = Extract<MarkupNode, { attribs: Record<string, string> }>

export interface RetailNavigationContract {
  configuredTitle: string
  customTitle: string | undefined
  isTabRoute: boolean
}

function elements(nodes: MarkupNode[]): MarkupElement[] {
  return nodes.filter((node): node is MarkupElement => 'attribs' in node)
}

function hasClass(node: MarkupElement, name: string) {
  return (node.attribs.class ?? '').split(/\s+/).includes(name)
}

function descendants(nodes: MarkupNode[]): MarkupElement[] {
  return elements(nodes).flatMap(node => [node, ...descendants(node.children)])
}

function one(nodes: MarkupElement[], label: string) {
  if (nodes.length !== 1) {
    throw new Error(`Retail parity expected exactly one ${label}, received ${nodes.length}`)
  }
  return nodes[0]!
}

function hasUnexpectedText(nodes: MarkupNode[]) {
  return nodes.some(node => node.type === 'text' && node.data.trim().length > 0)
}

function isHomeIcon(node: MarkupElement) {
  if (node.attribs.name === 'home'
    && (node.name === 't-icon' || (node.name === 'miniprogram_npm' && 'icon' in node.attribs && 'tdesign-miniprogram' in node.attribs))) {
    return true
  }
  const children = elements(node.children)
  return node.name === 'view' && hasClass(node, 't-icon') && children.length === 1
    && children[0]!.name === 'label' && hasClass(children[0]!, 't-icon-home')
    && hasClass(children[0]!, 't-icon-base')
}

function outer(node: MarkupNode) {
  return DomUtils.getOuterHTML(node, { xmlMode: true, decodeEntities: false })
}

function isFeedbackHost(node: MarkupElement) {
  return node.name === 't-toast' || node.name === 't-dialog'
    || (node.name === 'miniprogram_npm' && ('overlay' in node.attribs || 'popup' in node.attribs))
}

function hasBusinessContent(nodes: MarkupNode[]): boolean {
  return elements(nodes).some(node => node.name === 'slot'
    ? hasBusinessContent(node.children)
    : !isFeedbackHost(node))
}

/** 验证唯一默认布局和自定义导航，仅投影已验收的导航及两层外壳。 */
export function projectRetailTemplateWxml(source: string, contract: RetailNavigationContract) {
  const document = parseDocument(source, {
    xmlMode: true,
    decodeEntities: false,
    lowerCaseAttributeNames: false,
    lowerCaseTags: false,
  })
  const all = descendants(document.children)
  const layout = one(all.filter(node => hasClass(node, 'layout-default')), 'default layout')
  if (layout.name !== 'view') {
    throw new Error('Retail parity refuses an unknown default layout element')
  }
  const shell = layout.parent
  if (!shell || !('attribs' in shell)
    || !(shell.name === 'weapp-layout-default' || (shell.name === 'layouts' && 'default' in shell.attribs))) {
    throw new Error('Retail parity refuses an unknown default layout shell')
  }
  if (all.filter(node => node.name === 'weapp-layout-default' || node.name === 'layouts').length !== 1
    || elements(shell.children).length !== 1 || hasUnexpectedText(shell.children)) {
    throw new Error('Retail parity refuses multiple or nontransparent layout shells')
  }
  const parent = shell.parent
  if (!parent || (parent.type !== 'root' && !('name' in parent && parent.name === 'page'))) {
    throw new Error('Retail parity default layout must be a document-level root')
  }
  const navigation = one(all.filter(node => hasClass(node, 'layout-navigation')), 'custom navigation')
  if (navigation.parent !== layout) {
    throw new Error('Retail parity custom navigation must belong to the default layout')
  }
  const bar = one(elements(navigation.children), 'navigation bar')
  if (!hasClass(bar, 'layout-navigation__bar')) {
    throw new Error('Retail parity refuses an unknown navigation bar')
  }
  const barChildren = elements(bar.children)
  const title = one(barChildren.filter(node => hasClass(node, 'layout-navigation__title')), 'navigation title')
  const left = one(barChildren.filter(node => hasClass(node, 'layout-navigation__side--left')), 'left navigation side')
  const right = one(barChildren.filter(node => hasClass(node, 'layout-navigation__side') && node !== left), 'right navigation side')
  if (barChildren.length !== 3 || elements(right.children).length !== 0 || elements(title.children).length !== 0
    || [navigation, bar, left, right].some(node => hasUnexpectedText(node.children))) {
    throw new Error('Retail parity refuses unknown navigation siblings')
  }
  if ([navigation, bar, title, left, right].some(node => node.name !== 'view')) {
    throw new Error('Retail parity refuses unknown navigation element tags')
  }
  const titleText = DomUtils.textContent(title).trim()
  if (!titleText || (contract.configuredTitle && titleText !== contract.configuredTitle)) {
    throw new Error('Retail parity custom navigation title does not satisfy its page configuration')
  }
  const buttons = descendants(left.children).filter(node => hasClass(node, 'layout-navigation__button'))
  const expectedButtonCount = contract.isTabRoute ? 0 : 1
  if (buttons.length !== expectedButtonCount || elements(left.children).length !== expectedButtonCount
    || (buttons[0] && elements(left.children)[0] !== buttons[0])) {
    throw new Error('Retail parity custom navigation action does not match a fresh reLaunch stack')
  }
  if (buttons[0]) {
    const icon = one(elements(buttons[0].children), 'home navigation icon')
    if (buttons[0].name !== 'view' || !isHomeIcon(icon) || hasUnexpectedText(buttons[0].children)) {
      throw new Error('Retail parity expected the home action after reLaunch')
    }
  }
  const remaining = layout.children.filter(node => node !== navigation)
  if (!hasBusinessContent(remaining)) {
    throw new Error('Retail parity refuses an empty business document')
  }
  const shellIndex = parent.children.indexOf(shell)
  if (shellIndex < 0) {
    throw new Error('Retail parity default layout has no document parent')
  }
  const navigationWxml = outer(navigation)
  parent.children.splice(shellIndex, 1, ...remaining)
  return {
    comparisonWxml: outer(document),
    navigation: {
      title: titleText,
      titleSource: contract.configuredTitle ? 'page-config' : 'custom-navigation-dom',
      configuredNativeTitle: contract.configuredTitle,
      configuredCustomTitle: contract.customTitle ?? null,
      nativeTitleUiObserved: false,
      buttonCount: buttons.length,
      rawWxml: navigationWxml,
    },
  }
}

/** 将导航可见性与动作语义附加到原首屏检查点，不减少业务检查点。 */
export function retailNavigationNodes(contract: RetailNavigationContract): DomNodeExpectation[] {
  return [
    { selector: xpathClass('layout-navigation'), query: 'xpath', count: 1, visible: true },
    {
      selector: xpathClass('layout-navigation__title'),
      query: 'xpath',
      count: 1,
      visible: true,
      ...(contract.configuredTitle ? { text: contract.configuredTitle } : {}),
    },
    { selector: xpathClass('layout-navigation__button'), query: 'xpath', count: contract.isTabRoute ? 0 : 1, visible: true },
    { selector: `${xpathClass('layout-navigation__button')}${xpathClass('t-icon-home')}`, query: 'xpath', count: contract.isTabRoute ? 0 : 1 },
  ]
}

/** 原生页面保持完整根不变，模板页仅应用明确的导航投影契约。 */
export function projectRetailParityWxml(source: string, contract?: RetailNavigationContract) {
  return contract ? projectRetailTemplateWxml(source, contract) : { comparisonWxml: source, navigation: null }
}
