export function createRefresherAppearance(root: ShadowRoot, viewport: HTMLDivElement) {
  const indicator = root.ownerDocument.createElement('div')
  indicator.className = 'refresher'
  indicator.setAttribute('aria-hidden', 'true')
  const slot = root.ownerDocument.createElement('slot')
  slot.name = 'refresher'
  const spinner = root.ownerDocument.createElement('span')
  spinner.className = 'refresher-spinner'
  slot.append(spinner)
  indicator.append(slot)
  root.insertBefore(indicator, viewport)
  return {
    sync(host: HTMLElement) {
      indicator.style.background = host.getAttribute('refresher-background') ?? 'transparent'
      const style = host.getAttribute('refresher-default-style') ?? 'black'
      spinner.hidden = style === 'none'
      spinner.style.color = style === 'white' ? '#fff' : '#000'
    },
    update(dy: number, phase: string) {
      indicator.style.height = `${dy}px`
      indicator.dataset.state = phase
      viewport.style.transform = dy > 0 ? `translateY(${dy}px)` : ''
      viewport.style.transition = phase === 'refreshing' || phase === 'restoring' ? 'transform 180ms ease-out' : ''
    },
    remove() {
      indicator.remove()
      viewport.style.transform = ''
      viewport.style.transition = ''
    },
  }
}

export const REFRESHER_STYLE = `
  :host { position: relative; overflow: hidden; }
  .refresher { position: absolute; inset: 0 0 auto; display: grid; place-items: center; overflow: hidden; }
  .refresher > slot { display: contents; }
  .refresher-spinner { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; opacity: .65; }
  .refresher-spinner[hidden] { display: none; }
  .refresher[data-state="refreshing"] .refresher-spinner { animation: weapp-refresher-spin 800ms linear infinite; }
  @keyframes weapp-refresher-spin { to { transform: rotate(360deg); } }
`
