// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import {
  registerNativeMediaElement,
  resolveNativeMediaElement,
} from '../src/runtime/nativeComponents/mediaRegistry'
import { currentDateValue, renderPickerEditors } from '../src/runtime/nativeComponents/picker/editors'
import { resolvePickerColumns } from '../src/runtime/nativeComponents/picker/helpers'
import {
  PICKER_VIEW_COLUMN_CHANGE_EVENT,
  PICKER_VIEW_PICK_END_EVENT,
  PICKER_VIEW_PICK_START_EVENT,
} from '../src/runtime/nativeComponents/pickerView/helpers'

function appendElement<T extends HTMLElement>(tagName: string, attributes: Record<string, string> = {}) {
  const element = document.createElement(tagName) as T
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }
  document.body.append(element)
  return element
}

function dispatchPointer(target: EventTarget, name: string, init: Partial<PointerEventInit> = {}) {
  target.dispatchEvent(new PointerEvent(name, {
    bubbles: true,
    button: 0,
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    ...init,
  }))
}

describe('advanced native custom elements', () => {
  beforeAll(() => ensureNativeComponentsDefined())

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('edits selector, multi-selector, temporal and region picker values', () => {
    const onValueChange = vi.fn()
    const onColumnChange = vi.fn()
    const createOptions = (overrides: Record<string, unknown>) => ({
      mode: 'selector' as const,
      range: ['One', 'Two'],
      value: 0,
      onValueChange,
      onColumnChange,
      ...overrides,
    })

    const [selector] = renderPickerEditors(createOptions({}))
    expect((selector as HTMLSelectElement).size).toBe(3)
    ;(selector as HTMLSelectElement).value = '1'
    selector.dispatchEvent(new Event('change'))
    expect(onValueChange).toHaveBeenLastCalledWith(1)

    const multi = renderPickerEditors(createOptions({
      mode: 'multiSelector',
      range: [['A', 'B'], ['C', 'D']],
      value: [0, 0],
    }))
    ;(multi[1] as HTMLSelectElement).value = '1'
    multi[1]!.dispatchEvent(new Event('change'))
    expect(onValueChange).toHaveBeenLastCalledWith([0, 1])
    expect(onColumnChange).toHaveBeenCalledWith(1, 1)

    const [date] = renderPickerEditors(createOptions({
      mode: 'date',
      fields: 'year',
      start: '2020-01-01',
      end: '2030-12-31',
      value: '2026-07-29',
    }))
    expect((date as HTMLInputElement).type).toBe('number')
    expect((date as HTMLInputElement).value).toBe('2026')
    expect((date as HTMLInputElement).min).toBe('2020')
    ;(date as HTMLInputElement).value = '2028'
    date.dispatchEvent(new Event('input'))
    expect(onValueChange).toHaveBeenLastCalledWith('2028')

    const [time] = renderPickerEditors(createOptions({ mode: 'time', value: '12:30' }))
    expect((time as HTMLInputElement).type).toBe('time')
    const [month] = renderPickerEditors(createOptions({ mode: 'date', fields: 'month', value: '2026-07' }))
    expect((month as HTMLInputElement).type).toBe('month')
    const [boundedDate] = renderPickerEditors(createOptions({
      mode: 'date',
      start: '2020-01-01',
      end: '2030-12-31',
      value: undefined,
    }))
    expect((boundedDate as HTMLInputElement).min).toBe('2020-01-01')
    expect((boundedDate as HTMLInputElement).max).toBe('2030-12-31')
    expect((boundedDate as HTMLInputElement).value).toBe('')

    const region = renderPickerEditors(createOptions({
      mode: 'region',
      customItem: 'All',
      level: 'sub-district',
      value: ['A'],
    }))
    expect(region).toHaveLength(4)
    expect((region[1] as HTMLInputElement).value).toBe('All')
    ;(region[1] as HTMLInputElement).value = 'B'
    region[1]!.dispatchEvent(new Event('input'))
    expect(onValueChange).toHaveBeenLastCalledWith(['A', 'B'])
    expect(renderPickerEditors(createOptions({ mode: 'region', level: 'province' }))).toHaveLength(1)
    expect(renderPickerEditors(createOptions({ mode: 'region', level: 'city' }))).toHaveLength(2)
    expect(currentDateValue('year')).toMatch(/^\d{4}$/)
    expect(resolvePickerColumns([], 'time')).toEqual([])
  })

  it('opens, confirms, cancels and resets picker elements', () => {
    const picker = appendElement<any>('weapp-picker', {
      'header-text': 'Choose',
      'name': 'choice',
      'range': '["One","Two"]',
      'value': '0',
    })
    const change = vi.fn()
    const cancel = vi.fn()
    picker.addEventListener('change', change)
    picker.addEventListener('cancel', cancel)
    expect(picker.formControlName).toBe('choice')
    expect(picker.formControlValue).toBe(0)
    expect(picker.formControlDisabled).toBe(false)

    picker.formActivate()
    const backdrop = picker.shadowRoot!.querySelector('.backdrop') as HTMLDivElement
    const select = picker.shadowRoot!.querySelector('select')!
    expect(backdrop.hidden).toBe(false)
    expect(picker.shadowRoot!.querySelector('.title')!.textContent).toBe('Choose')
    select.value = '1'
    select.dispatchEvent(new Event('change'))
    const buttons = picker.shadowRoot!.querySelectorAll('button')
    buttons[1]!.click()
    expect(change.mock.calls[0]?.[0].detail).toEqual({ value: 1 })
    expect(picker.formControlValue).toBe(1)

    picker.click()
    buttons[0]!.click()
    expect(cancel).toHaveBeenCalledTimes(1)
    picker.click()
    backdrop.click()
    expect(cancel).toHaveBeenCalledTimes(2)
    picker.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    expect(backdrop.hidden).toBe(false)
    picker.formReset()
    expect(picker.formControlValue).toBe(0)

    picker.setAttribute('disabled', '')
    picker.open()
    expect(backdrop.hidden).toBe(true)
    picker.range = [{ label: 'A' }]
    picker.value = 0
    picker.remove()
  })

  it('renders date, time, multi-selector and region picker modes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T12:00:00Z'))
    const picker = appendElement<any>('weapp-picker', { mode: 'date', fields: 'month' })
    expect(picker.formControlValue).toBe('2026-07')
    picker.open()
    expect((picker.shadowRoot!.querySelector('input') as HTMLInputElement).type).toBe('month')
    picker.shadowRoot!.querySelectorAll('button')[0]!.click()

    picker.setAttribute('mode', 'time')
    picker.value = undefined
    picker.open()
    expect((picker.shadowRoot!.querySelector('input') as HTMLInputElement).type).toBe('time')
    picker.shadowRoot!.querySelectorAll('button')[0]!.click()

    picker.setAttribute('mode', 'multiSelector')
    picker.range = [['A', 'B'], ['C']]
    picker.value = [1, 0]
    picker.open()
    expect(picker.shadowRoot!.querySelectorAll('select')).toHaveLength(2)
    picker.shadowRoot!.querySelectorAll('button')[0]!.click()

    picker.setAttribute('mode', 'region')
    picker.value = ['Province', 'City']
    picker.open()
    expect(picker.shadowRoot!.querySelectorAll('input')).toHaveLength(3)
  })

  it('covers picker parsing, reconnect, open-state, and keyboard boundaries', () => {
    const detached = document.createElement('weapp-picker') as any
    detached.open()
    detached.formReset()

    const picker = document.createElement('weapp-picker') as any
    picker.setAttribute('range', '{invalid-json')
    picker.setAttribute('tabindex', '3')
    document.body.append(picker)
    picker.connectedCallback()
    expect(picker.formControlName).toBe('')
    expect(picker.tabIndex).toBe(3)

    picker.open()
    picker.open()
    const panel = picker.shadowRoot!.querySelector('.panel') as HTMLDivElement
    panel.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    const escape = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
    picker.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(false)
    const space = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ' ' })
    picker.dispatchEvent(space)
    expect(space.defaultPrevented).toBe(true)

    picker.setAttribute('mode', 'date')
    picker.value = '2025-02-03'
    expect(picker.formControlValue).toBe('2025-02-03')
    picker.setAttribute('mode', 'time')
    picker.value = '08:30'
    expect(picker.formControlValue).toBe('08:30')
    picker.setAttribute('mode', 'region')
    picker.value = [null, 'City']
    expect(picker.formControlValue).toEqual(['', 'City'])

    vi.stubGlobal('document', undefined)
    picker.value = ['Province']
    picker.disconnectedCallback()
  })

  it('emits picker multi-column changes and tolerates a missing document before connection', () => {
    const picker = appendElement<any>('weapp-picker', { mode: 'multiSelector' })
    picker.range = [['A', 'B'], ['C', 'D']]
    picker.value = [0, 0]
    const columnChange = vi.fn()
    picker.addEventListener('columnchange', columnChange)
    picker.open()
    const second = picker.shadowRoot!.querySelectorAll<HTMLSelectElement>('select')[1]!
    second.value = '1'
    second.dispatchEvent(new Event('change'))
    expect(columnChange.mock.calls[0]?.[0].detail).toEqual({ column: 1, value: 1 })

    const disconnected = document.createElement('weapp-picker') as any
    vi.stubGlobal('document', undefined)
    disconnected.connectedCallback()
    disconnected.open()
    disconnected.disconnectedCallback()
  })

  it('coordinates picker-view columns and emits phase events', () => {
    vi.useFakeTimers()
    const pickerView = document.createElement('weapp-picker-view') as any
    pickerView.setAttribute('value', '[0,1]')
    pickerView.setAttribute('indicator-style', 'height: 40px')
    pickerView.setAttribute('indicator-class', 'custom-indicator')
    pickerView.setAttribute('mask-style', 'opacity: 0.5')
    pickerView.setAttribute('mask-class', 'custom-mask')
    const first = document.createElement('weapp-picker-view-column') as any
    const second = document.createElement('weapp-picker-view-column') as any
    for (const value of ['A', 'B', 'C']) {
      const item = document.createElement('div')
      item.textContent = value
      first.append(item)
    }
    for (const value of ['D', 'E']) {
      const item = document.createElement('div')
      item.textContent = value
      second.append(item)
    }
    pickerView.append(first, second)
    document.body.append(pickerView)
    vi.runAllTimers()

    expect(first.itemCount).toBe(3)
    expect(first.itemHeight).toBe(34)
    expect(first.selectedIndex).toBe(0)
    expect(second.selectedIndex).toBe(1)
    expect(pickerView.shadowRoot!.querySelector('.indicator')!.classList.contains('custom-indicator')).toBe(true)
    expect(pickerView.shadowRoot!.querySelector('.mask')!.classList.contains('custom-mask')).toBe(true)

    const pickstart = vi.fn()
    const pickend = vi.fn()
    const change = vi.fn()
    pickerView.addEventListener('pickstart', pickstart)
    pickerView.addEventListener('pickend', pickend)
    pickerView.addEventListener('change', change)
    const scroller = first.shadowRoot!.querySelector('.scroller') as HTMLDivElement
    scroller.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    scroller.scrollTop = 68
    scroller.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(100)
    expect(pickstart).toHaveBeenCalledTimes(1)
    expect(pickend).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ detail: { value: [2, 1] } }))

    pickerView.setAttribute('immediate-change', '')
    first.dispatchEvent(new CustomEvent(PICKER_VIEW_COLUMN_CHANGE_EVENT, {
      bubbles: true,
      composed: true,
      detail: { value: 1, phase: 'changing' },
    }))
    expect(change).toHaveBeenCalledTimes(2)
    first.dispatchEvent(new CustomEvent(PICKER_VIEW_COLUMN_CHANGE_EVENT, {
      bubbles: true,
      composed: true,
      detail: { value: 1, phase: 'changing' },
    }))
    expect(change).toHaveBeenCalledTimes(2)
    first.dispatchEvent(new CustomEvent(PICKER_VIEW_COLUMN_CHANGE_EVENT, {
      bubbles: true,
      composed: true,
      detail: { value: 1, phase: 'end' },
    }))
    pickerView.removeAttribute('immediate-change')
    first.dispatchEvent(new CustomEvent(PICKER_VIEW_COLUMN_CHANGE_EVENT, {
      bubbles: true,
      composed: true,
      detail: { value: 1, phase: 'changing' },
    }))
    const outsider = document.createElement('div')
    pickerView.append(outsider)
    outsider.dispatchEvent(new CustomEvent(PICKER_VIEW_COLUMN_CHANGE_EVENT, {
      bubbles: true,
      detail: { value: 0, phase: 'end' },
    }))
    pickerView.dispatchEvent(new CustomEvent(PICKER_VIEW_PICK_START_EVENT, { bubbles: true }))
    pickerView.dispatchEvent(new CustomEvent(PICKER_VIEW_PICK_END_EVENT, { bubbles: true }))
    first.dispatchEvent(new CustomEvent('weapp-picker-view-column-ready', {
      bubbles: true,
      composed: true,
    }))
    pickerView.value = [1, 0]
    pickerView.connectedCallback()
    pickerView.remove()
  })

  it('covers picker-view parsing, default styles and host boundaries', () => {
    const pickerView = document.createElement('weapp-picker-view') as any
    expect(pickerView.value).toEqual([])
    pickerView.setAttribute('value', '{invalid-json')
    expect(pickerView.value).toEqual([])
    pickerView.setAttribute('value', '{"value":1}')
    expect(pickerView.value).toEqual([])
    pickerView.attachShadow({ mode: 'open' })
    document.body.append(pickerView)
    expect(pickerView.shadowRoot!.querySelector('.indicator')!.className).toBe('indicator')
    expect(pickerView.shadowRoot!.querySelector('.mask')!.className).toBe('mask mask--top')

    const empty = document.createElement('weapp-picker-view') as any
    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    empty.connectedCallback()
    empty.disconnectedCallback()
    vi.stubGlobal('document', runtimeDocument)
  })

  it('covers picker-view column capability and timer lifecycle boundaries', () => {
    vi.useFakeTimers()
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))
    const resizeCallbacks: Array<() => void> = []
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback)
      }

      observe = observe
      disconnect = disconnect
    })

    const detached = document.createElement('weapp-picker-view-column') as any
    expect(detached.itemCount).toBe(0)
    expect(detached.selectedIndex).toBe(0)
    detached.setSelectedIndex(Number.NaN)

    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    detached.connectedCallback()
    detached.disconnectedCallback()
    vi.stubGlobal('document', runtimeDocument)

    const column = document.createElement('weapp-picker-view-column') as any
    const item = document.createElement('div')
    item.getBoundingClientRect = () => ({ height: 40 } as DOMRect)
    column.append(item)
    document.body.append(column)
    column.connectedCallback()
    resizeCallbacks[0]!()
    expect(column.itemHeight).toBe(40)
    expect(observe).toHaveBeenCalledWith(column.shadowRoot!.querySelector('.scroller'))

    const scroller = column.shadowRoot!.querySelector('.scroller') as HTMLDivElement
    column.setSelectedIndex(-2)
    scroller.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    scroller.dispatchEvent(new Event('scroll'))
    for (const frame of frames.splice(0)) {
      frame(0)
    }

    scroller.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    scroller.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    scroller.scrollTop = 40
    scroller.dispatchEvent(new Event('scroll'))
    scroller.dispatchEvent(new Event('scroll'))
    column.remove()
    expect(disconnect).toHaveBeenCalledTimes(1)

    const idleEnd = appendElement<any>('weapp-picker-view-column')
    const idleScroller = idleEnd.shadowRoot!.querySelector('.scroller') as HTMLDivElement
    idleScroller.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    vi.advanceTimersByTime(100)
    idleEnd.remove()
  })

  it('synchronizes slider, icon, canvas and rich-text elements', () => {
    const slider = appendElement<any>('weapp-slider', {
      'active-color': '#00ff00',
      'background-color': '#111111',
      'block-color': '#ffffff',
      'block-size': '24',
      'max': '20',
      'min': '10',
      'name': 'volume',
      'show-value': '',
      'step': '2',
      'value': '14',
    })
    const input = slider.shadowRoot!.querySelector('input')!
    const output = slider.shadowRoot!.querySelector('output')!
    expect(slider.formControlValue).toBe(14)
    expect(output.hidden).toBe(false)
    expect(output.textContent).toBe('14')
    const changing = vi.fn()
    const change = vi.fn()
    slider.addEventListener('changing', changing)
    slider.addEventListener('change', change)
    input.valueAsNumber = 18
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(changing).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenCalledTimes(1)
    slider.value = 20
    slider.formReset()
    expect(slider.value).toBe(14)
    slider.formActivate()
    slider.setAttribute('disabled', '')
    expect(slider.formControlDisabled).toBe(true)

    const icon = appendElement('weapp-icon', { color: '#123456', size: '32', type: 'success' })
    expect(icon.shadowRoot!.querySelector('.icon')!.classList.contains('success')).toBe(true)
    expect(icon.style.getPropertyValue('--weapp-icon-size')).toBe('32px')
    icon.setAttribute('type', 'unknown')
    expect(icon.shadowRoot!.querySelector('.icon')!.getAttribute('aria-label')).toBe('success')

    const canvas = appendElement<any>('weapp-canvas', {
      'canvas-id': 'chart',
      'disable-scroll': '',
      'height': '240',
      'width': '320',
    })
    expect(canvas.canvasElement.width).toBe(320)
    expect(canvas.canvasElement.height).toBe(240)
    expect(canvas.canvasElement.style.touchAction).toBe('none')
    expect(resolveNativeMediaElement('canvas', 'chart')).toBe(canvas.canvasElement)
    canvas.setAttribute('width', 'bad')
    expect(canvas.canvasElement.width).toBe(300)
    canvas.remove()
    expect(resolveNativeMediaElement('canvas', 'chart')).toBeUndefined()

    const richText = appendElement<any>('weapp-rich-text', { 'space': 'nbsp', 'user-select': '' })
    richText.nodes = [{
      name: 'a',
      attrs: { href: 'https://example.com' },
      children: [{ type: 'text', text: 'Link' }],
    }]
    const anchor = richText.shadowRoot!.querySelector('a')!
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    anchor.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    const sameNodes = richText.nodes
    richText.nodes = sameNodes
    const plainClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    richText.shadowRoot!.querySelector('.content')!.dispatchEvent(plainClick)
    expect(plainClick.defaultPrevented).toBe(false)
    richText.setAttribute('nodes', '<b>Bold</b>')
    richText.removeAttribute('nodes')
    richText.removeAttribute('space')
    richText.removeAttribute('user-select')
  })

  it('covers slider detached, default-style, reconnect, and missing-document boundaries', () => {
    const detached = document.createElement('weapp-slider') as any
    expect(detached.value).toBe(0)
    expect(detached.formControlName).toBe('')
    expect(detached.formControlValue).toBe(0)
    detached.formReset()
    detached.formActivate()
    detached.setAttribute('value', '25')

    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    detached.connectedCallback()
    detached.disconnectedCallback()
    vi.stubGlobal('document', runtimeDocument)

    const defaults = appendElement<any>('weapp-slider')
    defaults.connectedCallback()
    expect(defaults.style.getPropertyValue('--weapp-slider-active-color')).toBe('#1aad19')
    expect(defaults.style.getPropertyValue('--weapp-slider-background-color')).toBe('#e9e9e9')
    expect(defaults.style.getPropertyValue('--weapp-slider-block-color')).toBe('#ffffff')

    defaults.setAttribute('selected-color', '#123456')
    defaults.setAttribute('color', '#abcdef')
    expect(defaults.style.getPropertyValue('--weapp-slider-active-color')).toBe('#123456')
    expect(defaults.style.getPropertyValue('--weapp-slider-background-color')).toBe('#abcdef')
  })

  it('emits video state and maintains native media registrations', () => {
    const video = appendElement<any>('weapp-video', {
      'autoplay': '',
      'id': 'hero-video',
      'initial-time': '4',
      'loop': '',
      'muted': '',
      'object-fit': 'cover',
      'poster': '/poster.png',
      'src': '/movie.mp4',
    })
    const nativeVideo = video.videoElement as HTMLVideoElement
    expect(nativeVideo.autoplay).toBe(true)
    expect(nativeVideo.controls).toBe(true)
    expect(nativeVideo.currentTime).toBe(4)
    expect(nativeVideo.style.objectFit).toBe('cover')
    expect(resolveNativeMediaElement('video', 'hero-video')).toBe(nativeVideo)

    Object.defineProperties(nativeVideo, {
      buffered: { configurable: true, value: { length: 1, end: () => 3 } },
      currentTime: { configurable: true, writable: true, value: 2 },
      duration: { configurable: true, value: 10 },
      videoHeight: { configurable: true, value: 720 },
      videoWidth: { configurable: true, value: 1280 },
    })
    const events = new Map<string, ReturnType<typeof vi.fn>>()
    for (const name of ['play', 'pause', 'ended', 'waiting', 'timeupdate', 'progress', 'loadedmetadata', 'error', 'fullscreenchange']) {
      const handler = vi.fn()
      events.set(name, handler)
      video.addEventListener(name, handler)
    }
    for (const name of ['play', 'pause', 'ended', 'waiting', 'timeupdate', 'progress', 'loadedmetadata', 'error']) {
      nativeVideo.dispatchEvent(new Event(name))
    }
    expect(events.get('timeupdate')!.mock.calls[0]?.[0].detail).toEqual({ currentTime: 2, duration: 10 })
    expect(events.get('progress')!.mock.calls[0]?.[0].detail).toEqual({ buffered: 30 })
    expect(events.get('loadedmetadata')!.mock.calls[0]?.[0].detail).toEqual({ width: 1280, height: 720, duration: 10 })

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: nativeVideo })
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(events.get('fullscreenchange')!.mock.calls[0]?.[0].detail).toEqual({ fullScreen: true, direction: 'horizontal' })
    video.removeAttribute('src')
    video.setAttribute('initial-time', '-1')
    video.remove()
    expect(resolveNativeMediaElement('video', 'hero-video')).toBeUndefined()

    const fallback = document.createElement('canvas')
    registerNativeMediaElement('canvas', [null, '', 'fallback'], fallback)
    expect(resolveNativeMediaElement('canvas', 'fallback')).toBe(fallback)
    expect(resolveNativeMediaElement('canvas', '')).toBeUndefined()
  })

  it('covers video defaults, media failures and host capability boundaries', () => {
    const detached = document.createElement('weapp-video') as any
    detached.setAttribute('initial-time', '')
    detached.attributeChangedCallback()
    detached.disconnectedCallback()

    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    detached.connectedCallback()
    vi.stubGlobal('document', runtimeDocument)

    const video = document.createElement('weapp-video') as any
    video.attachShadow({ mode: 'open' })
    document.body.append(video)
    video.connectedCallback()
    const nativeVideo = video.videoElement as HTMLVideoElement
    expect(nativeVideo.poster).toBe('')
    expect(nativeVideo.controls).toBe(true)

    video.setAttribute('controls', 'false')
    video.setAttribute('initial-time', 'not-a-number')
    expect(nativeVideo.controls).toBe(false)

    Object.defineProperty(nativeVideo, 'buffered', {
      configurable: true,
      value: { length: 0, end: vi.fn() },
    })
    nativeVideo.dispatchEvent(new Event('progress'))
    Object.defineProperty(nativeVideo, 'buffered', {
      configurable: true,
      value: { length: 1, end: () => { throw new Error('blocked') } },
    })
    nativeVideo.dispatchEvent(new Event('progress'))

    Object.defineProperty(nativeVideo, 'duration', { configurable: true, value: Number.NaN })
    nativeVideo.dispatchEvent(new Event('loadedmetadata'))
    Object.defineProperty(nativeVideo, 'error', {
      configurable: true,
      value: { message: 'decode failed' },
    })
    nativeVideo.dispatchEvent(new Event('error'))
    Object.defineProperty(nativeVideo, 'error', {
      configurable: true,
      value: { message: '' },
    })
    nativeVideo.dispatchEvent(new Event('error'))
    nativeVideo.dispatchEvent(new Event('fullscreenchange', { bubbles: true }))

    Object.defineProperty(nativeVideo, 'currentTime', {
      configurable: true,
      get() {
        return 0
      },
      set() {
        throw new Error('blocked')
      },
    })
    video.setAttribute('initial-time', '3')
  })

  it('animates progress, swipes and auto-plays swiper items', async () => {
    vi.useFakeTimers()
    const progress = appendElement('weapp-progress', {
      'active-color': '#00ff00',
      'background-color': '#eeeeee',
      'border-radius': '4',
      'font-size': '14',
      'percent': '25',
      'show-info': '',
      'stroke-width': '6',
    })
    expect(progress.style.getPropertyValue('--weapp-progress-percent')).toBe('25%')
    expect(progress.shadowRoot!.querySelector('.info')!.textContent).toBe('25%')
    const activeend = vi.fn()
    progress.addEventListener('activeend', activeend)
    progress.setAttribute('active', '')
    progress.setAttribute('duration', '0')
    progress.setAttribute('percent', '50')
    vi.runAllTimers()
    await Promise.resolve()
    expect(activeend).toHaveBeenCalled()
    progress.remove()

    const swiper = document.createElement('weapp-swiper')
    swiper.setAttribute('indicator-dots', '')
    swiper.setAttribute('duration', '10')
    swiper.setAttribute('interval', '16')
    swiper.setAttribute('previous-margin', '8px')
    swiper.setAttribute('next-margin', '4px')
    const first = document.createElement('weapp-swiper-item')
    first.setAttribute('item-id', 'first')
    const second = document.createElement('weapp-swiper-item')
    second.setAttribute('item-id', 'second')
    swiper.append(first, second)
    document.body.append(swiper)
    const track = swiper.shadowRoot!.querySelector('.track') as HTMLDivElement
    Object.defineProperty(track, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 300, height: 150, x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 150, toJSON() {} }),
    })
    swiper.setAttribute('current-item-id', 'second')
    expect(second.getAttribute('data-active')).toBe('')
    const change = vi.fn()
    const transition = vi.fn()
    const animationfinish = vi.fn()
    swiper.addEventListener('change', change)
    swiper.addEventListener('transition', transition)
    swiper.addEventListener('animationfinish', animationfinish)
    swiper.removeAttribute('current-item-id')
    swiper.setAttribute('current', '0')
    vi.advanceTimersByTime(10)
    expect(change).toHaveBeenCalled()
    expect(animationfinish).toHaveBeenCalled()

    const viewport = swiper.shadowRoot!.querySelector('.viewport')!
    dispatchPointer(viewport, 'pointerdown', { clientX: 200 })
    dispatchPointer(viewport, 'pointermove', { clientX: 20 })
    dispatchPointer(viewport, 'pointerup', { clientX: 20 })
    expect(transition).toHaveBeenCalled()
    swiper.setAttribute('autoplay', '')
    vi.advanceTimersByTime(16)
    swiper.setAttribute('vertical', '')
    swiper.setAttribute('display-multiple-items', '2')
    swiper.setAttribute('easing-function', 'linear')
    swiper.setAttribute('disable-touch', '')
    dispatchPointer(viewport, 'pointerdown')
    swiper.remove()
  })

  it('covers swiper detached, vertical, edge and resize boundaries', () => {
    vi.useFakeTimers()
    const resizeCallbacks: Array<() => void> = []
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback)
      }

      observe = observe
      disconnect = disconnect
    })

    const detached = document.createElement('weapp-swiper') as any
    detached.setAttribute('current', '1')
    detached.attributeChangedCallback('current')
    detached.disconnectedCallback()
    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    detached.connectedCallback()
    vi.stubGlobal('document', runtimeDocument)

    const swiper = document.createElement('weapp-swiper')
    swiper.setAttribute('vertical', '')
    swiper.setAttribute('autoplay', '')
    swiper.setAttribute('interval', '16')
    const first = document.createElement('weapp-swiper-item')
    const second = document.createElement('weapp-swiper-item')
    const third = document.createElement('weapp-swiper-item')
    swiper.append(first, second, third)
    document.body.append(swiper)
    const viewport = swiper.shadowRoot!.querySelector('.viewport') as HTMLDivElement
    const track = swiper.shadowRoot!.querySelector('.track') as HTMLDivElement
    Object.defineProperty(track, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: 300, width: 150 } as DOMRect),
    })
    resizeCallbacks[0]!()
    expect(observe).toHaveBeenCalledWith(viewport)

    dispatchPointer(viewport, 'pointerdown', { clientY: 100 })
    dispatchPointer(viewport, 'pointermove', { clientY: 180 })
    dispatchPointer(viewport, 'pointerup', { clientY: 180 })
    expect(track.style.transform).toContain('translate3d(0,')

    swiper.setAttribute('current', '1')
    dispatchPointer(viewport, 'pointerdown', { clientY: 100 })
    dispatchPointer(viewport, 'pointermove', { clientY: 110 })
    dispatchPointer(viewport, 'pointercancel', { clientY: 110 })

    swiper.setAttribute('current', '2')
    dispatchPointer(viewport, 'pointerdown', { clientY: 100 })
    dispatchPointer(viewport, 'pointermove', { clientY: 20 })
    dispatchPointer(viewport, 'pointerup', { clientY: 20 })

    dispatchPointer(viewport, 'pointermove', { pointerId: 9 })
    dispatchPointer(viewport, 'pointerup', { pointerId: 9 })
    viewport.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 1, pointerId: 2 }))
    vi.advanceTimersByTime(16)
    swiper.remove()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('drives progress animation frames, cancellation and stale callbacks', async () => {
    vi.useFakeTimers()
    const frameCallbacks = new Map<number, FrameRequestCallback>()
    let nextFrame = 0
    const cancelAnimationFrame = vi.fn((id: number) => frameCallbacks.delete(id))
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      nextFrame += 1
      frameCallbacks.set(nextFrame, callback)
      return nextFrame
    }))
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
    const runNextFrame = (time: number) => {
      const entry = frameCallbacks.entries().next().value as [number, FrameRequestCallback] | undefined
      expect(entry).toBeDefined()
      frameCallbacks.delete(entry![0])
      entry![1](time)
    }

    const progress = appendElement('weapp-progress', {
      active: '',
      duration: '1',
      percent: '50',
    })
    const activeend = vi.fn()
    progress.addEventListener('activeend', activeend)
    runNextFrame(100)
    runNextFrame(100)
    runNextFrame(150)
    vi.advanceTimersByTime(100)
    expect(activeend).toHaveBeenCalledOnce()

    cancelAnimationFrame.mockImplementation(() => {})
    frameCallbacks.clear()
    progress.setAttribute('percent', '60')
    runNextFrame(200)
    progress.setAttribute('percent', '70')
    runNextFrame(200)
    runNextFrame(225)

    progress.setAttribute('percent', '80')
    runNextFrame(250)
    frameCallbacks.clear()
    progress.setAttribute('duration', '0')
    runNextFrame(300)
    await Promise.resolve()
    expect(activeend).toHaveBeenCalledTimes(2)

    progress.removeAttribute('active')
    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(progress.style.getPropertyValue('--weapp-progress-percent')).toBe('80%')

    progress.connectedCallback()
    progress.remove()
  })

  it('ignores a stale progress completion timer', () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const timerCallbacks: Array<() => void> = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('setTimeout', vi.fn((callback: () => void) => {
      timerCallbacks.push(callback)
      return timerCallbacks.length
    }))
    vi.stubGlobal('clearTimeout', vi.fn())
    const progress = appendElement('weapp-progress', { active: '', duration: '100', percent: '50' })
    const activeend = vi.fn()
    progress.addEventListener('activeend', activeend)
    frameCallbacks.shift()!(0)
    progress.setAttribute('percent', '75')
    timerCallbacks[0]!()
    expect(activeend).not.toHaveBeenCalled()
  })

  it('covers swiper resize, pointer boundaries, timer replacement and slot shrinkage', () => {
    vi.useFakeTimers()
    let resizeCallback: ResizeObserverCallback | undefined
    const disconnect = vi.fn()
    const observe = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe = observe
      disconnect = disconnect
    })

    const swiper = document.createElement('weapp-swiper')
    swiper.setAttribute('duration', '20')
    swiper.setAttribute('interval', '16')
    const first = document.createElement('weapp-swiper-item')
    first.setAttribute('item-id', 'first')
    const second = document.createElement('weapp-swiper-item')
    second.setAttribute('item-id', 'second')
    swiper.append(first, second)
    document.body.append(swiper)
    swiper.connectedCallback()

    const viewport = swiper.shadowRoot!.querySelector('.viewport') as HTMLDivElement
    const track = swiper.shadowRoot!.querySelector('.track') as HTMLDivElement
    Object.defineProperty(track, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 200, height: 100 }),
    })
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    Object.defineProperties(viewport, {
      setPointerCapture: { configurable: true, value: setPointerCapture },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    })
    resizeCallback?.([], {} as ResizeObserver)
    expect(observe).toHaveBeenCalledWith(viewport)

    dispatchPointer(viewport, 'pointermove', { pointerId: 2 })
    dispatchPointer(viewport, 'pointerup', { pointerId: 2 })
    dispatchPointer(viewport, 'pointerdown', { button: 1 })
    dispatchPointer(viewport, 'pointerdown', { clientX: 20 })
    dispatchPointer(viewport, 'pointermove', { clientX: 120 })
    dispatchPointer(viewport, 'pointermove', { clientX: 100, pointerId: 2 })
    dispatchPointer(viewport, 'pointerup', { clientX: 120 })
    expect(setPointerCapture).toHaveBeenCalledWith(1)
    expect(releasePointerCapture).toHaveBeenCalledWith(1)

    swiper.setAttribute('current', '1')
    swiper.setAttribute('current', '0')
    swiper.setAttribute('autoplay', '')
    swiper.setAttribute('autoplay', 'false')
    swiper.setAttribute('autoplay', '')
    vi.advanceTimersByTime(16)

    swiper.setAttribute('current', '1')
    second.remove()
    swiper.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'))
    expect(first.getAttribute('data-active')).toBe('')

    swiper.remove()
    expect(disconnect).toHaveBeenCalled()
  })

  it('moves movable-view within its area and renders cover primitives', () => {
    const area = appendElement('weapp-movable-area')
    const view = document.createElement('weapp-movable-view')
    view.setAttribute('direction', 'all')
    view.setAttribute('animation', '')
    Object.defineProperty(area, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 200, height: 100, x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 100, toJSON() {} }),
    })
    Object.defineProperty(view, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 20, height: 10, x: 0, y: 0, top: 0, left: 0, right: 20, bottom: 10, toJSON() {} }),
    })
    area.append(view)
    view.connectedCallback()
    const change = vi.fn()
    const horizontal = vi.fn()
    const vertical = vi.fn()
    view.addEventListener('change', change)
    view.addEventListener('htouchmove', horizontal)
    view.addEventListener('vtouchmove', vertical)
    dispatchPointer(view, 'pointerdown', { clientX: 10, clientY: 10 })
    dispatchPointer(view, 'pointermove', { clientX: 70, clientY: 50 })
    dispatchPointer(view, 'pointerup', { clientX: 70, clientY: 50 })
    expect(view.style.transform).toBe('translate3d(60px, 40px, 0)')
    expect(change).toHaveBeenCalledTimes(2)
    expect(horizontal).toHaveBeenCalledTimes(1)
    expect(vertical).toHaveBeenCalledTimes(1)

    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    Object.assign(view, { setPointerCapture, releasePointerCapture })
    view.setAttribute('direction', 'horizontal')
    dispatchPointer(view, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 3 })
    dispatchPointer(view, 'pointermove', { clientX: 20, clientY: 20, pointerId: 4 })
    dispatchPointer(view, 'pointerup', { pointerId: 4 })
    dispatchPointer(view, 'pointermove', { clientX: 20, clientY: 40, pointerId: 3 })
    dispatchPointer(view, 'pointerup', { pointerId: 3 })
    expect(setPointerCapture).toHaveBeenCalledWith(3)
    expect(releasePointerCapture).toHaveBeenCalledWith(3)

    view.setAttribute('direction', 'vertical')
    dispatchPointer(view, 'pointerdown', { clientX: 10, clientY: 10 })
    dispatchPointer(view, 'pointermove', { clientX: 30, clientY: 20 })
    dispatchPointer(view, 'pointerup')

    view.setAttribute('direction', 'none')
    dispatchPointer(view, 'pointerdown', { clientX: 10, clientY: 10 })
    dispatchPointer(view, 'pointermove', { clientX: 30, clientY: 30 })
    dispatchPointer(view, 'pointercancel')

    view.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    view.dispatchEvent(new Event('pointerup', { bubbles: true }))

    view.setAttribute('disabled', '')
    dispatchPointer(view, 'pointerdown')
    dispatchPointer(view, 'pointermove', { pointerId: 2 })
    dispatchPointer(view, 'pointerup', { pointerId: 2 })
    view.remove()

    const coverView = appendElement('weapp-cover-view')
    const coverImage = appendElement('weapp-cover-image', { src: '/cover.png' })
    const primitiveView = appendElement('weapp-view')
    const primitiveText = appendElement('weapp-text')
    expect(coverView.style.zIndex).toBe('2')
    expect(coverImage.style.position).toBe('absolute')
    expect(coverImage.style.zIndex).toBe('2')
    expect(primitiveView).toBeInstanceOf(HTMLElement)
    expect(primitiveText).toBeInstanceOf(HTMLElement)
  })
})
