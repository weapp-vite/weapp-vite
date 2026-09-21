interface AppSelectMenuPosition {
  placement: 'bottom' | 'top'
  style: Record<string, string>
}

function readCssPixel(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function measureOptionChrome(option: HTMLElement, label: HTMLElement) {
  const style = getComputedStyle(option)
  const nonLabelWidth = Array.from(option.children).reduce((width, child) => {
    return child === label ? width : width + child.getBoundingClientRect().width
  }, 0)
  const gapCount = Math.max(0, option.children.length - 1)
  return nonLabelWidth
    + readCssPixel(style.paddingLeft)
    + readCssPixel(style.paddingRight)
    + readCssPixel(style.borderLeftWidth)
    + readCssPixel(style.borderRightWidth)
    + readCssPixel(style.columnGap) * gapCount
}

function measureMenuContentWidth(menu: HTMLElement) {
  const option = menu.querySelector<HTMLElement>('[role="option"]')
  const firstLabel = option?.querySelector<HTMLElement>('[data-option-label]')
  if (!option || !firstLabel) {
    return menu.offsetWidth
  }

  const menuChrome = menu.offsetWidth - menu.clientWidth
  const menuInset = menu.clientWidth - option.offsetWidth
  const optionChrome = measureOptionChrome(option, firstLabel)
  let contentWidth = 0
  for (const label of menu.querySelectorAll<HTMLElement>('[data-option-label]')) {
    const previousWhiteSpace = label.style.whiteSpace
    label.style.whiteSpace = 'nowrap'
    contentWidth = Math.max(contentWidth, label.scrollWidth)
    label.style.whiteSpace = previousWhiteSpace
  }
  return contentWidth + optionChrome + menuInset + menuChrome
}

export function resolveAppSelectMenuPosition(
  trigger: HTMLElement,
  menu: HTMLElement,
): AppSelectMenuPosition {
  const triggerRect = trigger.getBoundingClientRect()
  const viewport = window.visualViewport
  const viewportLeft = viewport?.offsetLeft ?? 0
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportWidth = viewport?.width ?? window.innerWidth
  const viewportHeight = viewport?.height ?? window.innerHeight
  const viewportRight = viewportLeft + viewportWidth
  const viewportBottom = viewportTop + viewportHeight
  const margin = 8
  const gap = 6
  const maxMenuWidth = Math.max(0, viewportWidth - margin * 2)
  const menuWidth = Math.min(
    Math.max(triggerRect.width, measureMenuContentWidth(menu)),
    maxMenuWidth,
  )
  menu.style.width = `${Math.round(menuWidth)}px`

  const availableBelow = viewportBottom - triggerRect.bottom - gap - margin
  const availableAbove = triggerRect.top - viewportTop - gap - margin
  const desiredHeight = Math.min(menu.scrollHeight + menu.offsetHeight - menu.clientHeight, 288)
  const opensAbove = availableBelow < Math.min(desiredHeight, 160) && availableAbove > availableBelow
  const availableHeight = Math.max(0, opensAbove ? availableAbove : availableBelow)
  const renderedHeight = Math.min(desiredHeight, availableHeight)
  const left = Math.min(
    Math.max(triggerRect.left, viewportLeft + margin),
    viewportRight - menuWidth - margin,
  )
  const top = opensAbove
    ? Math.max(viewportTop + margin, triggerRect.top - gap - renderedHeight)
    : Math.min(triggerRect.bottom + gap, viewportBottom - renderedHeight - margin)

  return {
    placement: opensAbove ? 'top' : 'bottom',
    style: {
      left: `${Math.round(left)}px`,
      maxHeight: `${Math.floor(availableHeight)}px`,
      top: `${Math.round(top)}px`,
      width: `${Math.round(menuWidth)}px`,
    },
  }
}
