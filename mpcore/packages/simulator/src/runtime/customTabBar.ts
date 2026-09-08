const LEADING_SLASH_RE = /^\/+/

export const CUSTOM_TAB_BAR_ALIAS = 'custom-tab-bar'
export const CUSTOM_TAB_BAR_COMPONENT_PATH = `${CUSTOM_TAB_BAR_ALIAS}/index`

export function getPageComponentScopePrefix(route: string) {
  return `page:${route.replace(LEADING_SLASH_RE, '')}/`
}

export function getCustomTabBarScopeId(route: string) {
  return `${getPageComponentScopePrefix(route)}${CUSTOM_TAB_BAR_ALIAS}`
}
