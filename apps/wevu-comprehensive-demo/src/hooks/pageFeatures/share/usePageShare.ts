import type { Ref } from 'wevu'
import { onAddToFavorites, onShareAppMessage, onShareTimeline } from 'wevu'

export interface UsePageShareOptions {
  title: Ref<string>
  path: Ref<string>
  query?: Ref<string>
}

function ensureShareMenuVisible() {
  wx.showShareMenu({
    withShareTicket: true,
    showShareItems: ['shareAppMessage', 'shareTimeline'],
  })
}

function registerShareHooks(options: UsePageShareOptions) {
  onShareAppMessage(() => {
    return {
      title: options.title.value || 'WeVu Share',
      path: options.path.value || '/',
    }
  })

  onShareTimeline(() => {
    return {
      title: options.title.value || 'WeVu Share (Timeline)',
    }
  })

  onAddToFavorites(() => {
    return {
      title: options.title.value || 'WeVu Favorites',
      query: options.query?.value || '',
    }
  })
}

export function usePageShare(options: UsePageShareOptions) {
  ensureShareMenuVisible()
  registerShareHooks(options)
}

