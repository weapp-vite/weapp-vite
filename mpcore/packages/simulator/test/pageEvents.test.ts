import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import {
  cleanupTempDirs,
  createAnimationFixture,
  createCanvasContextFixture,
  createComponentSelectorFixture,
  createIntersectionObserverFixture,
  createMediaQueryObserverFixture,
  createPageEventsFixture,
  createVideoContextFixture,
} from './helpers'

describe('page event alignment', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    cleanupTempDirs(tempDirs)
  })

  it('drives onPageScroll through wx.pageScrollTo and keeps success callbacks', () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/events/index')
    page.runScroll(120)

    expect(page.data.scrollTop).toBe(120)
    expect(page.data.logs).toEqual([
      'onPageScroll:{"scrollTop":120}',
    ])
    expect(page.data.callbacks).toEqual(['success', 'complete'])
  })

  it('supports wx.pageScrollTo selector targets in headless runtime', () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/events/index')
    page.runScrollBySelector()

    expect(page.data.scrollTop).toBe(236)
    expect(page.data.logs).toEqual([
      'onPageScroll:{"scrollTop":236}',
    ])
    expect(page.data.selectorCallbacks).toEqual(['success', 'complete'])
  })

  it('can trigger pull-down, reach-bottom, resize and route-done hooks from the testing bridge', async () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({ projectPath })

    const page = await miniProgram.reLaunch('/pages/events/index')
    await miniProgram.triggerPullDownRefresh()
    await miniProgram.triggerReachBottom()
    await miniProgram.triggerResize({
      size: {
        windowWidth: 375,
        windowHeight: 667,
      },
    })
    await miniProgram.triggerRouteDone({
      from: 'test',
    })
    await miniProgram.pageScrollTo(64)

    expect(await page.data('logs')).toEqual([
      'onPullDownRefresh',
      'onReachBottom',
      'onResize:{"size":{"windowWidth":375,"windowHeight":667}}',
      'onRouteDone:{"from":"test"}',
      'onPageScroll:{"scrollTop":64}',
    ])
    expect(await page.data('scrollTop')).toBe(64)
  })

  it('updates getSystemInfo results after resize events', () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/events/index')
    page.readSystemInfo()

    expect(page.data.systemInfoSync).toContain('"windowWidth":375')
    expect(page.data.systemInfoAsync).toContain('"windowHeight":667')

    session.triggerResize({
      size: {
        windowWidth: 412,
        windowHeight: 915,
      },
    })
    page.readSystemInfo()

    expect(page.data.systemInfoSync).toContain('"windowWidth":412')
    expect(page.data.systemInfoSync).toContain('"windowHeight":915')
    expect(session.getSystemInfo()).toMatchObject({
      screenHeight: 915,
      screenWidth: 412,
      windowHeight: 915,
      windowWidth: 412,
    })
  })

  it('tracks pull-down refresh state and stop calls in headless runtime', () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    session.reLaunch('/pages/events/index')
    expect(session.getPullDownRefreshState()).toEqual({
      active: false,
      stopCalls: 0,
    })

    session.triggerPullDownRefresh()

    expect(session.getPullDownRefreshState()).toEqual({
      active: false,
      stopCalls: 1,
    })
  })

  it('exposes compatibility info through getWindowInfo, getAppBaseInfo and canIUse', () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/events/index')
    page.readCompatibilityInfo()

    expect(page.data.windowInfoSync).toContain('"windowWidth":375')
    expect(page.data.windowInfoAsync).toContain('"statusBarHeight":20')
    expect(page.data.appBaseInfoSync).toContain('"platform":"devtools"')
    expect(page.data.canIUseSummary).toContain('"getWindowInfo":true')
    expect(page.data.canIUseSummary).toContain('"getWindowInfoReturn":true')
    expect(page.data.canIUseSummary).toContain('"menuButtonRect":true')
    expect(page.data.canIUseSummary).toContain('"nextTick":true')
    expect(page.data.canIUseSummary).toContain('"missing":false')
    expect(page.data.menuButtonRect).toContain('"width":87')

    session.triggerResize({
      size: {
        windowWidth: 390,
        windowHeight: 844,
      },
    })
    page.readCompatibilityInfo()

    expect(page.data.windowInfoSync).toContain('"windowWidth":390')
    expect(page.data.menuButtonRect).toContain('"right":378')
    expect(session.getWindowInfo()).toMatchObject({
      screenHeight: 844,
      screenWidth: 390,
      windowHeight: 844,
      windowWidth: 390,
    })
    expect(session.getMenuButtonBoundingClientRect()).toMatchObject({
      right: 378,
      width: 87,
    })
    expect(session.getAppBaseInfo()).toMatchObject({
      host: {
        env: 'devtools',
      },
      platform: 'devtools',
    })
  })

  it('supports createVideoContext event dispatch in headless runtime', () => {
    const projectPath = createVideoContextFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/video/index')
    page.playVideo()

    expect(page.data.logs).toEqual([
      'play:{"currentTime":12.5}',
      'pause:{"currentTime":12.5}',
      'fullscreen:{"currentTime":12.5,"fullScreen":true}',
      'fullscreen:{"currentTime":12.5,"fullScreen":false}',
    ])
  })

  it('keeps exact component selectors from matching nested descendants in headless runtime', () => {
    const projectPath = createComponentSelectorFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/selectors/index')
    page.inspectSelectors()

    expect(page.data.exactSnapshot).toContain('"hasCard":true')
    expect(page.data.exactSnapshot).toContain('"size":1')
    expect(page.data.nestedSnapshot).toContain('"label":"stable"')
    expect(page.data.nestedSnapshot).toContain('"size":1')
  })

  it('supports createIntersectionObserver in headless runtime', async () => {
    const projectPath = createIntersectionObserverFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/observer/index')
    page.inspectObserver()
    page.inspectScopedObserver()

    await Promise.resolve()

    expect(page.data.directSnapshot).toContain('"id":"hero-card"')
    expect(page.data.directSnapshot).toContain('"intersectionRatio":1')
    expect(page.data.directSnapshot).toContain('"top":16')
    expect(page.data.scopedSnapshot).toContain('"id":"hero-card"')
    expect(page.data.scopedSnapshot).toContain('"intersectionRatio":1')
    expect(page.data.scopedSnapshot).toContain('"width":80')
  })

  it('supports createMediaQueryObserver in headless runtime', () => {
    const projectPath = createMediaQueryObserverFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/media/index')
    page.inspectPageMediaQuery()
    page.inspectComponentMediaQuery()

    expect(page.data.pageMatches).toEqual([false])
    expect(page.data.componentMatches).toEqual([false])

    session.triggerResize({
      size: {
        windowWidth: 412,
        windowHeight: 915,
      },
    })

    expect(page.data.pageMatches).toEqual([false, true])
    expect(page.data.componentMatches).toEqual([false, true])
  })

  it('supports createAnimation in headless runtime', () => {
    const projectPath = createAnimationFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/animation/index')
    page.runAnimationLab()

    expect(page.data.animationSnapshot).toContain('"type":"opacity"')
    expect(page.data.animationSnapshot).toContain('"type":"translate"')
    expect(page.data.animationSnapshot).toContain('"type":"rotate"')
    expect(page.data.animationSnapshot).toContain('"type":"backgroundColor"')
    expect(page.data.animationSnapshot).toContain('"timingFunction":"ease-in"')
    expect(page.data.animationSecondSnapshot).toBe('{"actions":[]}')
  })

  it('supports createCanvasContext in headless runtime', () => {
    const projectPath = createCanvasContextFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/canvas/index')
    page.runCanvasLab()
    page.exportCanvasLab()
    page.saveExportedCanvasLab()
    page.saveMissingCanvasImageLab()
    page.inspectExportedCanvasImageLab()
    page.inspectMissingCanvasImageLab()
    page.previewCanvasImageLab()
    page.previewInvalidCanvasImageLab()
    page.chooseImageLab()
    page.chooseMessageFileLab()
    page.compressChosenImageLab()
    page.compressMissingImageLab()
    page.chooseVideoLab()
    page.saveMissingChosenVideoLab()
    page.inspectChosenVideoLab()
    page.inspectMissingChosenVideoLab()
    page.chooseMediaLab()
    page.saveTempVideoLab()
    page.saveMissingTempVideoLab()
    page.runComponentCanvasLab()

    expect(page.data.canvasSnapshot).toContain('"canvasId":"hero-canvas"')
    expect(page.data.canvasSnapshot).toContain('"type":"fillRect"')
    expect(page.data.canvasSnapshot).toContain('"type":"beginPath"')
    expect(page.data.canvasSnapshot).toContain('"type":"arc"')
    expect(page.data.canvasSnapshot).toContain('"type":"arcTo"')
    expect(page.data.canvasSnapshot).toContain('"type":"bezierCurveTo"')
    expect(page.data.canvasSnapshot).toContain('"type":"clip"')
    expect(page.data.canvasSnapshot).toContain('"args":["evenodd"]')
    expect(page.data.canvasSnapshot).toContain('"type":"quadraticCurveTo"')
    expect(page.data.canvasSnapshot).toContain('"type":"rect"')
    expect(page.data.canvasSnapshot).toContain('"type":"save"')
    expect(page.data.canvasSnapshot).toContain('"type":"restore"')
    expect(page.data.canvasSnapshot).toContain('"type":"translate"')
    expect(page.data.canvasSnapshot).toContain('"type":"rotate"')
    expect(page.data.canvasSnapshot).toContain('"type":"scale"')
    expect(page.data.canvasSnapshot).toContain('"type":"setLineCap"')
    expect(page.data.canvasSnapshot).toContain('"type":"setLineJoin"')
    expect(page.data.canvasSnapshot).toContain('"type":"setMiterLimit"')
    expect(page.data.canvasSnapshot).toContain('"type":"fillText"')
    expect(page.data.canvasSnapshot).toContain('"type":"setFontSize"')
    expect(page.data.canvasSnapshot).toContain('"type":"setGlobalAlpha"')
    expect(page.data.canvasSnapshot).toContain('"type":"setShadow"')
    expect(page.data.canvasSnapshot).toContain('"type":"setTextAlign"')
    expect(page.data.canvasSnapshot).toContain('"type":"setTextBaseline"')
    expect(page.data.canvasSnapshot).toContain('"type":"setLineDash"')
    expect(page.data.canvasSnapshot).toContain('"fontSize":16')
    expect(page.data.canvasSnapshot).toContain('"globalAlpha":0.6')
    expect(page.data.canvasSnapshot).toContain('"lineCap":"round"')
    expect(page.data.canvasSnapshot).toContain('"lineDash":[6,3]')
    expect(page.data.canvasSnapshot).toContain('"lineDashOffset":2')
    expect(page.data.canvasSnapshot).toContain('"lineJoin":"bevel"')
    expect(page.data.canvasSnapshot).toContain('"miterLimit":6')
    expect(page.data.canvasSnapshot).toContain('"shadowBlur":4')
    expect(page.data.canvasSnapshot).toContain('"shadowColor":"#112233"')
    expect(page.data.canvasSnapshot).toContain('"shadowOffsetX":2')
    expect(page.data.canvasSnapshot).toContain('"shadowOffsetY":3')
    expect(page.data.canvasSnapshot).toContain('"textAlign":"start"')
    expect(page.data.canvasSnapshot).toContain('"textBaseline":"alphabetic"')
    expect(page.data.canvasSnapshot).toContain('"fillStyle":"#ff5500"')
    expect(page.data.canvasSnapshot).toContain('"type":"strokeText"')
    expect(page.data.canvasSnapshot).toContain('"/tmp/canvas-thumb.png",2,4')
    expect(page.data.canvasSnapshot).toContain('"/tmp/canvas-sprite.png",0,0,24,24,8,10,12,14')
    expect(page.data.canvasTempFilePath).toContain('headless://wxfile/temp/')
    expect(page.data.canvasTempFileContent).toContain('"canvasId":"hero-canvas"')
    expect(page.data.canvasTempFileContent).toContain('"type":"fillRect"')
    expect(page.data.canvasTempFileContent).toContain('"fileType":"png"')
    expect(page.data.canvasSavedImageInfo).toContain('"errMsg":"saveImageToPhotosAlbum:ok"')
    expect(page.data.canvasSavedImageMissingInfo).toContain('"error":"saveImageToPhotosAlbum:fail file not found: headless://wxfile/temp/missing-canvas-export.png"')
    expect(page.data.canvasImageInfo).toContain('"errMsg":"getImageInfo:ok"')
    expect(page.data.canvasImageInfo).toContain('"width":60')
    expect(page.data.canvasImageInfo).toContain('"height":40')
    expect(page.data.canvasImageInfo).toContain('"type":"png"')
    expect(page.data.canvasImageInfoMissing).toContain('"error":"getImageInfo:fail file not found: headless://wxfile/temp/missing-canvas-image-info.png"')
    expect(page.data.previewImageInfo).toContain('"errMsg":"previewImage:ok"')
    expect(page.data.previewImageInvalidInfo).toContain('"error":"previewImage:fail invalid urls"')
    expect(page.data.chosenImageInfo).toContain('"errMsg":"chooseImage:ok"')
    expect(page.data.chosenImageInfo).toContain('headless://wxfile/temp/chosen-image-01.jpg')
    expect(page.data.chosenImageDetail).toContain('"errMsg":"getImageInfo:ok"')
    expect(page.data.chosenImageDetail).toContain('"type":"jpeg"')
    expect(page.data.chosenImageDetail).toContain('"width":160')
    expect(page.data.chosenImageDetail).toContain('"height":120')
    expect(page.data.chosenMessageFileInfo).toContain('"errMsg":"chooseMessageFile:ok"')
    expect(page.data.chosenMessageFileInfo).toContain('"name":"message-file-01.png"')
    expect(page.data.chosenMessageFileInfo).toContain('"type":"pdf"')
    expect(page.data.chosenMessageFileInfo).toContain('"type":"mp4"')
    expect(page.data.chosenMessageFileImageDetail).toContain('"errMsg":"getImageInfo:ok"')
    expect(page.data.chosenMessageFileImageDetail).toContain('"type":"png"')
    expect(page.data.chosenMessageFileImageDetail).toContain('"width":160')
    expect(page.data.chosenMessageFileVideoDetail).toContain('"errMsg":"getVideoInfo:ok"')
    expect(page.data.chosenMessageFileVideoDetail).toContain('"type":"mp4"')
    expect(page.data.chosenMessageFileVideoDetail).toContain('"duration":20')
    expect(page.data.compressedImageInfo).toContain('"errMsg":"compressImage:ok"')
    expect(page.data.compressedImageInfo).toContain('headless://wxfile/temp/compressed-image-')
    expect(page.data.compressedImageDetail).toContain('"errMsg":"getImageInfo:ok"')
    expect(page.data.compressedImageDetail).toContain('"width":64')
    expect(page.data.compressedImageDetail).toContain('"height":48')
    expect(page.data.compressedImageDetail).toContain('"type":"jpeg"')
    expect(page.data.compressedImageMissingInfo).toContain('"error":"compressImage:fail file not found: headless://wxfile/temp/missing-compress-image.jpg"')
    expect(page.data.chosenVideoInfo).toContain('"errMsg":"chooseVideo:ok"')
    expect(page.data.chosenVideoInfo).toContain('"duration":18')
    expect(page.data.chosenVideoInfo).toContain('"width":640')
    expect(page.data.chosenVideoInfo).toContain('"height":360')
    expect(page.data.chosenVideoSavedInfo).toContain('"errMsg":"saveVideoToPhotosAlbum:ok"')
    expect(page.data.chosenVideoMissingSaveInfo).toContain('"error":"saveVideoToPhotosAlbum:fail file not found: headless://wxfile/temp/missing-chosen-video.mp4"')
    expect(page.data.chosenVideoDetail).toContain('"errMsg":"getVideoInfo:ok"')
    expect(page.data.chosenVideoDetail).toContain('"duration":18')
    expect(page.data.chosenVideoDetail).toContain('"width":640')
    expect(page.data.chosenVideoDetail).toContain('"height":360')
    expect(page.data.chosenVideoDetailMissing).toContain('"error":"getVideoInfo:fail file not found: headless://wxfile/temp/missing-video-info.mp4"')
    expect(page.data.chosenMediaInfo).toContain('"errMsg":"chooseMedia:ok"')
    expect(page.data.chosenMediaInfo).toContain('"type":"mix"')
    expect(page.data.chosenMediaInfo).toContain('"fileType":"image"')
    expect(page.data.chosenMediaInfo).toContain('"fileType":"video"')
    expect(page.data.chosenMediaImageDetail).toContain('"errMsg":"getImageInfo:ok"')
    expect(page.data.chosenMediaImageDetail).toContain('"type":"jpeg"')
    expect(page.data.chosenMediaVideoSavedInfo).toContain('"errMsg":"saveVideoToPhotosAlbum:ok"')
    expect(page.data.chosenMediaVideoDetail).toContain('"errMsg":"getVideoInfo:ok"')
    expect(page.data.chosenMediaVideoDetail).toContain('"duration":19')
    expect(page.data.tempVideoSavedInfo).toContain('"errMsg":"saveVideoToPhotosAlbum:ok"')
    expect(page.data.tempVideoSavedMissingInfo).toContain('"error":"saveVideoToPhotosAlbum:fail file not found: headless://wxfile/temp/missing-fixture-video.mp4"')
    expect(page.data.textMeasureWidth).toBe(54)
    expect(page.data.componentCanvasSnapshot).toContain('"canvasId":"inner-canvas"')
    expect(page.data.componentCanvasSnapshot).toContain('"type":"strokeRect"')
    expect(page.data.componentCanvasSnapshot).toContain('"type":"translate"')
    expect(page.data.componentCanvasSnapshot).toContain('"type":"setLineCap"')
    expect(page.data.componentCanvasSnapshot).toContain('"type":"setGlobalAlpha"')
    expect(page.data.componentCanvasSnapshot).toContain('"type":"setLineDash"')
    expect(page.data.componentCanvasSnapshot).toContain('"type":"setShadow"')
    expect(page.data.componentCanvasSnapshot).toContain('"globalAlpha":0.8')
    expect(page.data.componentCanvasSnapshot).toContain('"lineCap":"square"')
    expect(page.data.componentCanvasSnapshot).toContain('"lineDash":[4,2]')
    expect(page.data.componentCanvasSnapshot).toContain('"lineDashOffset":0')
    expect(page.data.componentCanvasSnapshot).toContain('"shadowBlur":2')
    expect(page.data.componentCanvasSnapshot).toContain('"shadowColor":"#445566"')
    expect(page.data.componentCanvasSnapshot).toContain('"lineWidth":3')
  })
})
