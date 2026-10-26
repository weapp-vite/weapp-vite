export interface ScrollPosition {
  scrollLeft: number
  scrollTop: number
}

export function createScrollEventDetail(
  viewport: Pick<HTMLDivElement, 'scrollHeight' | 'scrollLeft' | 'scrollTop' | 'scrollWidth'>,
  previous: ScrollPosition,
) {
  return {
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
    scrollWidth: viewport.scrollWidth,
    scrollHeight: viewport.scrollHeight,
    deltaX: viewport.scrollLeft - previous.scrollLeft,
    deltaY: viewport.scrollTop - previous.scrollTop,
  }
}
