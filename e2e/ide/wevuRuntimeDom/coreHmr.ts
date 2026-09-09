import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'
import { runtimeLayoutNodes } from './allPages'

export interface CoreHmrMarkers {
  pageTemplateMarker: string
  pageScriptMarker: string
  pageStyleMarker: string
  sfcTemplateMarker: string
  sfcScriptMarker: string
  sfcStyleMarker: string
  layoutPageTemplateMarker: string
  layoutPageScriptMarker: string
  layoutPageStyleMarker: string
  sharedStoreMarker: string
}

function checkpoint(id: string, route: string, nodes: DomNodeExpectation[]): DomCheckpoint {
  return { id, route: `/pages/${route}/index`, action: `classic HMR ${id} 实际界面及对应更新状态`, nodes }
}

export function coreHmrPlan(markers: CoreHmrMarkers): DomCheckpoint[] {
  const hmr = (title: string, script: string, count = 1): DomNodeExpectation[] => [
    { selector: '.title', text: title },
    { selector: '#hmr-script', text: `script: ${script}` },
    { selector: '#hmr-count', text: `count: ${count}` },
  ]
  const sfc = (title: string, script: string): DomNodeExpectation[] => [
    { selector: '.title', text: title },
    { selector: '.marker', text: script },
  ]
  const layout = (title: string, script: string, mode: 'default' | 'admin' = 'admin'): DomNodeExpectation[] => [
    ...runtimeLayoutNodes(mode).filter(node => node.selector !== '#layout-script'),
    { selector: '.hero__eyebrow', text: title },
    { selector: '#layout-script', text: `script: ${script}` },
  ]
  const store: DomNodeExpectation[] = [
    { selector: '#store-setup', text: 'setup: 1 shared' },
    { selector: '#store-options', text: 'options: 1 shared' },
  ]
  return [
    checkpoint('page:initial', 'hmr', hmr('HMR', 'hmr', 0)),
    checkpoint('page:interacted', 'hmr', hmr('HMR', 'hmr')),
    checkpoint('page:template', 'hmr', hmr(markers.pageTemplateMarker, 'hmr')),
    // classic 脚本更新交由 IDE 重建 AppService；模板更新保留交互，脚本刷新恢复 store 初始值。
    checkpoint('page:script', 'hmr', hmr(markers.pageTemplateMarker, markers.pageScriptMarker, 0)),
    checkpoint('page:style', 'hmr', [
      ...hmr(markers.pageTemplateMarker, markers.pageScriptMarker, 0),
      { selector: '.page', styles: { 'background-color': 'rgb(220, 252, 231)' }, visible: true },
    ]),
    checkpoint('sfc:initial', 'hmr-sfc', sfc('HMR-SFC', 'HMR-SFC-SCRIPT')),
    checkpoint('sfc:template', 'hmr-sfc', sfc(markers.sfcTemplateMarker, 'HMR-SFC-SCRIPT')),
    checkpoint('sfc:script', 'hmr-sfc', sfc(markers.sfcTemplateMarker, markers.sfcScriptMarker)),
    checkpoint('sfc:style', 'hmr-sfc', [
      ...sfc(markers.sfcTemplateMarker, markers.sfcScriptMarker),
      { selector: '.marker', styles: { color: 'rgb(190, 18, 60)' }, visible: true },
    ]),
    checkpoint('layout:initial', 'layouts', layout('LAYOUTS-PAGE-TEMPLATE-BASE', 'LAYOUTS-PAGE-SCRIPT-BASE', 'default')),
    checkpoint('layout:admin', 'layouts', layout('LAYOUTS-PAGE-TEMPLATE-BASE', 'LAYOUTS-PAGE-SCRIPT-BASE')),
    checkpoint('layout:template', 'layouts', layout(markers.layoutPageTemplateMarker, 'LAYOUTS-PAGE-SCRIPT-BASE')),
    checkpoint('layout:script', 'layouts', layout(markers.layoutPageTemplateMarker, markers.layoutPageScriptMarker, 'default')),
    checkpoint('layout:script-admin', 'layouts', layout(markers.layoutPageTemplateMarker, markers.layoutPageScriptMarker)),
    checkpoint('layout:style', 'layouts', [
      ...layout(markers.layoutPageTemplateMarker, markers.layoutPageScriptMarker),
      { selector: '.page', styles: { 'background-color': 'rgb(224, 242, 254)' }, visible: true },
    ]),
    checkpoint('store:initial', 'store', [...store, { selector: '#store-initial-name', text: 'initial name: init' }]),
    checkpoint('store:updated', 'store', [...store, { selector: '#store-initial-name', text: `initial name: ${markers.sharedStoreMarker}` }]),
    checkpoint('store:shared', 'store-share', store),
  ]
}
