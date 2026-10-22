---
"@weapp-vite/web": patch
---

fix(web): 补齐页面级 onReachBottom 触底回调。

此前 Web 运行时只在页面滚动时转发 `onPageScroll`，没有调用 `onReachBottom`，用页面滚动做分页的页面在 Web 端滚到底不会加载下一页。

- 页面滚动到底部（距底部 50px，与 `onReachBottomDistance` 默认值一致）时调用一次 `onReachBottom`，`onPageScroll` 仍然先于它执行
- 只在进入底部区间时调用一次：页面追加内容后离开底部再滚到底会重新调用，停在底部继续滚动不会重复调用
- 内容不足一屏时不调用；切换页面时恢复滚动位置不算触底
