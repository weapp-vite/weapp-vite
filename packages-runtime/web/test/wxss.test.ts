import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import { createWxssPostcssPlugin, transformWxssToCss } from '../src/css/wxss'

describe('transformWxssToCss', () => {
  it('converts rpx units to px', () => {
    const input = '.btn { width: 100rpx; margin: 10rpx 5rpx; }'
    const { css } = transformWxssToCss(input, { pxPerRpx: 0.5 })
    expect(css).toContain('width: 50px')
    expect(css).toContain('margin: 5px 2.5px')
  })

  it('uses the runtime viewport variable by default', () => {
    const { css } = transformWxssToCss('.card { width: 750rpx; }')
    expect(css).toContain('width: calc(var(--rpx) * 750)')
  })

  it('uses custom runtime variables for finite design widths', () => {
    const { css } = transformWxssToCss('.card { width: 10rpx; }', {
      designWidth: 750,
      pxPerRpx: 0.5,
      rpxVar: '--custom-rpx',
    })
    expect(css).toContain('width: calc(var(--custom-rpx) * 10)')
  })

  it('maps safe-area env values to runtime viewport variables', () => {
    const result = transformWxssToCss(`
      .fixed {
        padding: env(safe-area-inset-top) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom) env(safe-area-inset-left);
      }
    `)

    expect(result.css).toContain('var(--weapp-safe-area-inset-top)')
    expect(result.css).toContain('var(--weapp-safe-area-inset-right)')
    expect(result.css).toContain('var(--weapp-safe-area-inset-bottom)')
    expect(result.css).toContain('var(--weapp-safe-area-inset-left)')
  })

  it('maps page and native component selectors without changing selector structure', () => {
    const input = `
      page > view.card text:first-child,
      form[data-state="ready"] > label + checkbox-group checkbox:checked,
      radio-group radio[disabled],
      scroll-view[data-axis="y"] image,
      textarea:focus + switch,
      navigator.link:hover + swiper > swiper-item[data-active] {
        width: 100rpx;
      }
      picker[data-mode="selector"] + picker-view > picker-view-column,
      slider[disabled] {
        min-height: 80rpx;
      }
      icon[type="success"] + progress[active] rich-text.note {
        color: green;
      }
      canvas.stage + video[object-fit="cover"] {
        display: block;
      }
      cover-view.overlay > cover-image,
      movable-area.drag-zone movable-view.handle {
        z-index: 3;
      }
    `
    const { css } = transformWxssToCss(input)
    expect(css).toContain(':host > weapp-view.card weapp-text:first-child')
    expect(css).toContain('weapp-form[data-state="ready"] > weapp-label + weapp-checkbox-group weapp-checkbox:checked')
    expect(css).toContain('weapp-radio-group weapp-radio[disabled]')
    expect(css).toContain('weapp-scroll-view[data-axis="y"] weapp-image')
    expect(css).toContain('weapp-textarea:focus + weapp-switch')
    expect(css).toContain('weapp-navigator.link:hover + weapp-swiper > weapp-swiper-item[data-active]')
    expect(css).toContain('weapp-picker[data-mode="selector"] + weapp-picker-view > weapp-picker-view-column')
    expect(css).toContain('weapp-slider[disabled]')
    expect(css).toContain('weapp-icon[type="success"] + weapp-progress[active] weapp-rich-text.note')
    expect(css).toContain('weapp-canvas.stage + weapp-video[object-fit="cover"]')
    expect(css).toContain('weapp-cover-view.overlay > weapp-cover-image')
    expect(css).toContain('weapp-movable-area.drag-zone weapp-movable-view.handle')
  })

  it('flattens Vue deep selectors before emitting browser CSS', () => {
    const input = `
      .wd-button :deep() .wd-button__loading,
      .wd-step--finished :deep(.wd-step__icon),
      page ::v-deep(view.active),
      .wd-card::v-deep(.wd-card__body) {
        width: 10rpx;
      }
    `
    const { css } = transformWxssToCss(input)

    expect(css).toContain('.wd-button  .wd-button__loading')
    expect(css).toContain('.wd-step--finished .wd-step__icon')
    expect(css).toContain(':host weapp-view.active')
    expect(css).toContain('.wd-card.wd-card__body')
    expect(css).not.toContain(':deep')
    expect(css).not.toContain('::v-deep')
  })

  it('emits virtual host part selectors for deep rules that target a component root', () => {
    const { css } = transformWxssToCss(`
      .wd-img-cropper :deep(.wd-img-cropper__cancel).is-text,
      .wd-notify :deep() .wd-popup.is-top {
        color: white;
      }
    `)

    expect(css).toContain('.wd-img-cropper .wd-img-cropper__cancel.is-text')
    expect(css).toContain('.wd-img-cropper .wd-img-cropper__cancel.is-text::part(wd-img-cropper__cancel)')
    expect(css).toContain('.wd-notify  .wd-popup.is-top')
    expect(css).toContain('.wd-notify  .wd-popup.is-top::part(wd-popup)')
  })

  it('places virtual host parts before target pseudo-elements', () => {
    const { css } = transformWxssToCss(`
      .wd-picker-view :deep() .wd-picker-view__roller::before {
        content: '';
      }
    `)

    expect(css).toContain('.wd-picker-view  .wd-picker-view__roller::part(wd-picker-view__roller)::before')
    expect(css).not.toContain('::before::part')
  })

  it('keeps structural pseudo-classes on the flattened host selector only', () => {
    const { css } = transformWxssToCss(`
      .wd-dialog :deep(.wd-dialog__actions-btn:not(:last-child)) {
        margin-right: 12px;
      }
    `)

    expect(css).toContain('.wd-dialog .wd-dialog__actions-btn:not(:last-child)')
    expect(css).not.toContain('::part')
  })

  it('does not emit an invalid part branch after a deep target with following siblings', () => {
    const { css } = transformWxssToCss(`
      .wd-button :deep(.wd-button__icon) + .wd-button__text {
        margin-left: 4px;
      }
    `)

    expect(css).toContain('.wd-button .wd-button__icon + .wd-button__text')
    expect(css).not.toContain('::part')
  })

  it('preserves part payload tags and handles deep selectors without nested nodes', () => {
    const { css } = transformWxssToCss(`
      weapp-view::part(view),
      .host :deep,
      .host :deep(view),
      .host :deep(.target:hover) {
        color: red;
      }
    `)
    expect(css).toContain('weapp-view::part(view)')
    expect(css).toContain('.host')
    expect(css).toContain('.target:hover')
  })

  it('runs through the PostCSS plugin entry', async () => {
    const plugin = createWxssPostcssPlugin({ pxPerRpx: 0.25 })
    const root = postcss.root({ nodes: [postcss.rule({ selector: '' })] })
    plugin.Once(root)
    const result = await postcss([plugin])
      .process('.card { width: 8rpx; }', { from: undefined })
    expect(result.css).toContain('width: 2px')
  })
})
