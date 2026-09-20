// 来自真实微信 IDE 的原生组件页面，包含查询操作前后的实际节点关系与回调顺序。
export const COMPONENT_INSTANCE_API_INITIAL_TRACE = [
  'parent:attached:none',
  'child:attached:none',
  'parent:linked:child',
  'child:linked:parent',
  'page:onLoad',
  'parent:ready:child',
  'child:ready:parent',
]
export const COMPONENT_INSTANCE_API_REMOVED_TRACE = [
  ...COMPONENT_INSTANCE_API_INITIAL_TRACE,
  'child:detached:parent',
  'parent:unlinked:none',
  'child:unlinked:none',
]
export const COMPONENT_INSTANCE_API_RESTORED_TRACE = [
  ...COMPONENT_INSTANCE_API_REMOVED_TRACE,
  'child:attached:none',
  'parent:linked:child',
  'child:linked:parent',
  'child:ready:parent',
]
