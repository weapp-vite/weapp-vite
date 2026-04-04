Page({
  data: {
    title: 'Component Lab',
    cardTitle: 'Queue health',
    status: 'stable',
    count: 3,
    events: [],
    eventShape: '',
    componentSnapshot: '',
    compoundSelectorSnapshot: '',
    compoundComponentSnapshot: '',
    directorySnapshot: '',
    downloadSnapshot: '',
    fileTransferFailureInfo: '',
    fileManagerSnapshot: '',
    animationSnapshot: '',
    canvasSnapshot: '',
    canvasSavedImageInfo: '',
    canvasSavedImageMissingInfo: '',
    canvasImageInfo: '',
    canvasImageInfoMissing: '',
    previewImageInfo: '',
    previewImageInvalidInfo: '',
    chosenImageInfo: '',
    chosenImageDetail: '',
    tempFileInfo: '',
    savedFileDigestInfo: '',
    missingFileInfo: '',
    compressedImageInfo: '',
    compressedImageDetail: '',
    compressedImageMissingInfo: '',
    chosenVideoInfo: '',
    chosenVideoSavedInfo: '',
    chosenVideoMissingSaveInfo: '',
    chosenVideoDetail: '',
    chosenVideoDetailMissing: '',
    chosenMediaInfo: '',
    chosenMediaImageDetail: '',
    chosenMediaVideoSavedInfo: '',
    chosenMediaVideoDetail: '',
    tempVideoSavedInfo: '',
    tempVideoSavedMissingInfo: '',
    canvasTempFileContent: '',
    canvasTempFilePath: '',
    canvasQuerySnapshot: '',
    intersectionObserverSnapshot: '',
    mediaQueryObserverSnapshot: '',
    requestSnapshot: '',
    videoContextSnapshot: '',
    savedOverwriteInfo: '',
    savedFilePath: '',
    savedFileInfo: '',
    saveFileMissingTempInfo: '',
    savedCopyOverwriteInfo: '',
    savedMissingInfo: '',
    savedMissingRemovalInfo: '',
    savedPostRemovalReadInfo: '',
    fileManagerMissingAccessInfo: '',
    fileManagerMissingCopyInfo: '',
    fileManagerMissingMkdirInfo: '',
    fileManagerMissingReadInfo: '',
    fileManagerMissingReadDirInfo: '',
    fileManagerMissingRenameInfo: '',
    fileManagerMissingRmdirInfo: '',
    fileManagerMissingStatInfo: '',
    fileManagerMissingUnlinkInfo: '',
    fileManagerUnsupportedReadEncodingInfo: '',
    fileManagerUnsupportedAppendEncodingInfo: '',
    fileManagerUnsupportedWriteEncodingInfo: '',
    savedOrderingInfo: '',
    savedRemovalInfo: '',
    savedRenameOverwriteInfo: '',
    savedRenameOutInfo: '',
    uploadedSnapshot: '',
    storageSnapshot: '',
    toastState: '',
    tapTrail: [],
    traces: [],
    flags: {
      showMeta: true,
    },
    quickActions: [
      { label: '切到 stable', status: 'stable' },
      { label: '切到 boosted', status: 'boosted' },
      { label: '切到 muted', status: 'muted' },
    ],
  },
  push(message) {
    this.setData({
      traces: [...this.data.traces, message],
    })
  },
  onLoad(query) {
    this.push('lab:onLoad:' + JSON.stringify(query))
  },
  promote() {
    this.setData({
      count: this.data.count + 1,
      status: 'boosted',
    }, () => {
      this.push('lab:promote')
    })
  },
  handlePulse(event) {
    const detail = event?.detail ?? {}
    this.setData({
      eventShape: JSON.stringify({
        bubbles: event?.bubbles ?? false,
        composed: event?.composed ?? false,
        dataset: event?.target?.dataset ?? {},
        targetId: event?.target?.id ?? '',
      }),
      events: [...this.data.events, detail.phase || 'unknown'],
    })
    this.push('lab:handlePulse:' + JSON.stringify(detail))
  },
  applyStatus(event) {
    const status = event?.currentTarget?.dataset?.status || 'stable'
    this.setData({
      status,
    }, () => {
      this.push('lab:applyStatus:' + status)
    })
  },
  toggleMeta() {
    this.setData({
      'flags.showMeta': !this.data.flags.showMeta,
    }, () => {
      this.push('lab:toggleMeta:' + this.data.flags.showMeta)
    })
  },
  recordTap(event) {
    const phase = event?.currentTarget?.dataset?.phase || 'unknown'
    this.setData({
      tapTrail: [...this.data.tapTrail, phase],
    }, () => {
      this.push('lab:recordTap:' + phase)
    })
  },
  loadMockQueue() {
    wx.request({
      url: 'https://mock.mpcore.dev/api/queue-health',
      success: (result) => {
        this.setData({
          requestSnapshot: JSON.stringify(result?.data ?? null),
        })
      },
      complete: () => {
        this.push('lab:loadMockQueue')
      }
    })
  },
  runVideoContextLab() {
    this.videoContext = wx.createVideoContext('lab-video', this)
    this.videoContext.seek(6)
    this.videoContext.play()
    this.videoContext.pause()
    this.videoContext.requestFullScreen()
    this.videoContext.exitFullScreen()
  },
  runIntersectionObserverLab() {
    const observer = this.createIntersectionObserver({
      thresholds: [0, 1],
    }).relativeToViewport()
    observer.observe('#observer-card', (result) => {
      this.setData({
        intersectionObserverSnapshot: JSON.stringify(result),
      })
      observer.disconnect()
    })
  },
  runMediaQueryObserverLab() {
    const observer = this.createMediaQueryObserver()
    observer.observe({
      minWidth: 400,
      orientation: 'portrait',
    }, (result) => {
      const windowInfo = wx.getWindowInfo()
      this.setData({
        mediaQueryObserverSnapshot: JSON.stringify({
          ...result,
          height: windowInfo.windowHeight,
          width: windowInfo.windowWidth,
        }),
      })
    })
  },
  runAnimationLab() {
    const animation = wx.createAnimation({
      duration: 160,
      timingFunction: 'ease-out',
      transformOrigin: '0 0 0',
    })
    animation.opacity(0.3).translate(8, 16).step({
      delay: 20,
    })
    animation.scale(1.1).rotate(30).backgroundColor('#ff5500').step()
    this.setData({
      animationSnapshot: JSON.stringify(animation.export()),
    })
  },
  runCanvasLab() {
    const ctx = wx.createCanvasContext('lab-canvas', this)
    ctx.setFillStyle('#ff5500')
    ctx.setGlobalAlpha(0.6)
    ctx.setLineCap('round')
    ctx.setLineDash([6, 3], 2)
    ctx.setLineJoin('bevel')
    ctx.setMiterLimit(6)
    ctx.setShadow(2, 3, 4, '#112233')
    ctx.fillRect(4, 6, 28, 18)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(16, 10)
    ctx.quadraticCurveTo(22, 4, 26, 16)
    ctx.bezierCurveTo(28, 8, 32, 14, 36, 6)
    ctx.arcTo(36, 6, 44, 16, 4)
    ctx.rect(2, 3, 14, 9)
    ctx.arc(10, 10, 6, 0, Math.PI, false)
    ctx.clip('evenodd')
    ctx.closePath()
    ctx.translate(3, 4)
    ctx.rotate(0.4)
    ctx.scale(1.1, 0.9)
    ctx.stroke()
    ctx.setFontSize(18)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    ctx.fillText('lab', 6, 20)
    ctx.strokeText('lab', 6, 20)
    ctx.drawImage('/tmp/lab-thumb.png', 2, 4)
    ctx.drawImage('/tmp/lab-sprite.png', 0, 0, 24, 24, 8, 10, 12, 14)
    ctx.restore()
    ctx.drawImage('/tmp/component-lab.png', 8, 10, 12, 12)
    ctx.draw(false, () => {
      this.setData({
        canvasSnapshot: JSON.stringify(ctx.__getSnapshot()),
      })
    })
  },
  exportCanvasLab() {
    const fs = wx.getFileSystemManager()
    wx.canvasToTempFilePath({
      canvasId: 'lab-canvas',
      component: this,
      destHeight: 40,
      destWidth: 60,
      fileType: 'png',
      height: 20,
      quality: 1,
      width: 30,
      x: 1,
      y: 2,
      success: ({ tempFilePath }) => {
        this.setData({
          canvasTempFileContent: fs.readFileSync(tempFilePath, 'utf8'),
          canvasTempFilePath: tempFilePath,
        })
      },
    })
  },
  saveExportedCanvasLab() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.canvasTempFilePath,
      success: (result) => {
        this.setData({
          canvasSavedImageInfo: JSON.stringify(result),
        })
      },
    })
  },
  saveMissingCanvasImageLab() {
    wx.saveImageToPhotosAlbum({
      filePath: 'headless://wxfile/temp/missing-component-lab-canvas-export.png',
      fail: (error) => {
        this.setData({
          canvasSavedImageMissingInfo: JSON.stringify({
            error: error.message,
          }),
        })
      },
    })
  },
  inspectExportedCanvasImageLab() {
    wx.getImageInfo({
      src: this.data.canvasTempFilePath,
      success: (result) => {
        this.setData({
          canvasImageInfo: JSON.stringify(result),
        })
      },
    })
  },
  inspectMissingCanvasImageLab() {
    wx.getImageInfo({
      src: 'headless://wxfile/temp/missing-component-lab-canvas-image-info.png',
      fail: (error) => {
        this.setData({
          canvasImageInfoMissing: JSON.stringify({
            error: error.message,
          }),
        })
      },
    })
  },
  previewCanvasImageLab() {
    wx.previewImage({
      current: this.data.canvasTempFilePath,
      urls: [
        this.data.canvasTempFilePath,
        'headless://wxfile/temp/preview-component-lab-alt.png',
      ],
      success: (result) => {
        this.setData({
          previewImageInfo: JSON.stringify(result),
        })
      },
    })
  },
  previewInvalidCanvasImageLab() {
    wx.previewImage({
      urls: [],
      fail: (error) => {
        this.setData({
          previewImageInvalidInfo: JSON.stringify({
            error: error.message,
          }),
        })
      },
    })
  },
  chooseImageLab() {
    wx.chooseImage({
      count: 2,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (result) => {
        this.setData({
          chosenImageInfo: JSON.stringify(result),
        })
        wx.getImageInfo({
          src: result.tempFilePaths[0],
          success: (imageInfo) => {
            this.setData({
              chosenImageDetail: JSON.stringify(imageInfo),
            })
          },
        })
      },
    })
  },
  chooseMessageFileLab() {
    wx.chooseMessageFile({
      count: 3,
      extension: ['png', 'pdf', 'mp4'],
      type: 'all',
      success: (result) => {
        this.setData({
          chosenMessageFileInfo: JSON.stringify(result),
        })
        const imageFile = result.tempFiles.find(file => file.type === 'png')
        const videoFile = result.tempFiles.find(file => file.type === 'mp4')
        if (imageFile && imageFile.path) {
          wx.getImageInfo({
            src: imageFile.path,
            success: (imageInfo) => {
              this.setData({
                chosenMessageFileImageDetail: JSON.stringify(imageInfo),
              })
            },
          })
        }
        if (videoFile && videoFile.path) {
          wx.getVideoInfo({
            src: videoFile.path,
            success: (videoInfo) => {
              this.setData({
                chosenMessageFileVideoDetail: JSON.stringify(videoInfo),
              })
            },
          })
        }
      },
    })
  },
  inspectFileInfoLab() {
    const fsManager = wx.getFileSystemManager()
    const tempFilePath = 'headless://wxfile/temp/file-info-source.txt'
    fsManager.writeFileSync(tempFilePath, 'component-lab-file-info')
    wx.getFileInfo({
      digestAlgorithm: 'md5',
      filePath: tempFilePath,
      success: (result) => {
        this.setData({
          tempFileInfo: JSON.stringify(result),
        })
      },
    })
    wx.saveFile({
      filePath: 'headless://saved/file-info/report.txt',
      tempFilePath,
      success: (saveResult) => {
        wx.getFileInfo({
          digestAlgorithm: 'sha1',
          filePath: saveResult.savedFilePath,
          success: (result) => {
            this.setData({
              savedFileDigestInfo: JSON.stringify(result),
            })
          },
        })
      },
    })
  },
  inspectMissingFileInfoLab() {
    wx.getFileInfo({
      filePath: 'headless://wxfile/temp/missing-file-info.txt',
      fail: (error) => {
        this.setData({
          missingFileInfo: JSON.stringify({
            error: error.message,
          }),
        })
      },
    })
  },
  compressChosenImageLab() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (result) => {
        wx.compressImage({
          compressedHeight: 48,
          compressedWidth: 64,
          quality: 70,
          src: result.tempFilePaths[0],
          success: (compressed) => {
            this.setData({
              compressedImageInfo: JSON.stringify(compressed),
            })
            wx.getImageInfo({
              src: compressed.tempFilePath,
              success: (imageInfo) => {
                this.setData({
                  compressedImageDetail: JSON.stringify(imageInfo),
                })
              },
            })
          },
        })
      },
    })
  },
  compressMissingImageLab() {
    wx.compressImage({
      src: 'headless://wxfile/temp/missing-compress-image.jpg',
      fail: (error) => {
        this.setData({
          compressedImageMissingInfo: JSON.stringify({
            error: error.message,
          }),
        })
      },
    })
  },
  chooseVideoLab() {
    wx.chooseVideo({
      compressed: true,
      maxDuration: 24,
      sourceType: ['album'],
      success: (result) => {
        this.setData({
          chosenVideoInfo: JSON.stringify(result),
        })
        wx.saveVideoToPhotosAlbum({
          filePath: result.tempFilePath,
          success: (savedResult) => {
            this.setData({
              chosenVideoSavedInfo: JSON.stringify(savedResult),
            })
          },
        })
      },
    })
  },
  saveMissingChosenVideoLab() {
    wx.saveVideoToPhotosAlbum({
      filePath: 'headless://wxfile/temp/missing-chosen-video.mp4',
      fail: (error) => {
        this.setData({
          chosenVideoMissingSaveInfo: JSON.stringify({
            error: error.message,
          }),
        })
      },
    })
  },
  inspectChosenVideoLab() {
    wx.chooseVideo({
      compressed: true,
      maxDuration: 24,
      sourceType: ['album'],
      success: (result) => {
        wx.getVideoInfo({
          src: result.tempFilePath,
          success: (videoInfo) => {
            this.setData({
              chosenVideoDetail: JSON.stringify(videoInfo),
            })
          },
        })
      },
    })
  },
  inspectMissingChosenVideoLab() {
    wx.getVideoInfo({
      src: 'headless://wxfile/temp/missing-video-info.mp4',
      fail: (error) => {
        this.setData({
          chosenVideoDetailMissing: JSON.stringify({
            error: error.message,
          }),
        })
      },
    })
  },
  chooseMediaLab() {
    wx.chooseMedia({
      count: 2,
      maxDuration: 24,
      mediaType: ['image', 'video'],
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (result) => {
        this.setData({
          chosenMediaInfo: JSON.stringify(result),
        })
        wx.getImageInfo({
          src: result.tempFiles[0]?.tempFilePath,
          success: (imageInfo) => {
            this.setData({
              chosenMediaImageDetail: JSON.stringify(imageInfo),
            })
          },
        })
        wx.saveVideoToPhotosAlbum({
          filePath: result.tempFiles[1]?.tempFilePath,
          success: (savedResult) => {
            this.setData({
              chosenMediaVideoSavedInfo: JSON.stringify(savedResult),
            })
          },
        })
        wx.getVideoInfo({
          src: result.tempFiles[1]?.tempFilePath,
          success: (videoInfo) => {
            this.setData({
              chosenMediaVideoDetail: JSON.stringify(videoInfo),
            })
          },
        })
      },
    })
  },
  saveTempVideoLab() {
    const fs = wx.getFileSystemManager()
    const filePath = 'headless://wxfile/temp/component-lab-video.mp4'
    fs.writeFileSync(filePath, 'component-lab-video')
    wx.saveVideoToPhotosAlbum({
      filePath,
      success: (result) => {
        this.setData({
          tempVideoSavedInfo: JSON.stringify(result),
        })
      },
    })
  },
  saveMissingTempVideoLab() {
    wx.saveVideoToPhotosAlbum({
      filePath: 'headless://wxfile/temp/missing-component-lab-video.mp4',
      fail: (error) => {
        this.setData({
          tempVideoSavedMissingInfo: JSON.stringify({
            error: error.message,
          }),
        })
      },
    })
  },
  inspectCanvasQuery() {
    wx.createSelectorQuery()
      .select('canvas')
      .fields({
        context: true,
        node: true,
      }, (result) => {
        result.context.setFillStyle('#00aa55')
        result.context.fillRect(2, 4, 12, 6)
        result.context.draw(false, () => {
          this.setData({
            canvasQuerySnapshot: JSON.stringify({
              node: result.node,
              snapshot: result.context.__getSnapshot(),
            }),
          })
        })
      })
      .exec()
  },
  handleVideoPlay(event) {
    this.setData({
      videoContextSnapshot: JSON.stringify({
        phase: 'play',
        ...event?.detail,
      }),
    })
  },
  handleVideoPause(event) {
    this.setData({
      videoContextSnapshot: JSON.stringify({
        phase: 'pause',
        ...event?.detail,
      }),
    })
  },
  handleVideoFullscreen(event) {
    this.setData({
      videoContextSnapshot: JSON.stringify({
        phase: 'fullscreen',
        ...event?.detail,
      }),
    })
  },
  runFileTransferLab() {
    wx.downloadFile({
      url: 'https://mock.mpcore.dev/files/component-lab-report.txt',
      success: (downloadResult) => {
        this.setData({
          downloadSnapshot: JSON.stringify(downloadResult),
        })
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
          success: (saveResult) => {
            this.setData({
              savedFilePath: saveResult.savedFilePath,
            })
            wx.getSavedFileInfo({
              filePath: saveResult.savedFilePath,
              success: (savedFileInfo) => {
                this.setData({
                  savedFileInfo: JSON.stringify(savedFileInfo),
                })
              },
              complete: () => {
                wx.uploadFile({
                  url: 'https://mock.mpcore.dev/upload/component-lab-report',
                  filePath: saveResult.savedFilePath,
                  name: 'report',
                  success: (uploadResult) => {
                    this.setData({
                      uploadedSnapshot: uploadResult.data,
                    })
                  },
                  complete: () => {
                    this.push('lab:runFileTransferLab:upload')
                  }
                })
              }
            })
          },
          complete: () => {
            this.push('lab:runFileTransferLab:save')
          }
        })
      },
      complete: () => {
        this.push('lab:runFileTransferLab:download')
      }
    })
  },
  runFileTransferFailureLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/component-lab-upload-no-mock.txt', 'upload-no-mock')
    const state = {
      downloadNoMockError: '',
      uploadMissingFileError: '',
      uploadNoMockError: '',
    }
    const flush = () => {
      if (!state.downloadNoMockError || !state.uploadMissingFileError || !state.uploadNoMockError) {
        return
      }
      this.setData({
        fileTransferFailureInfo: JSON.stringify(state),
      }, () => {
        this.push('lab:runFileTransferFailureLab')
      })
    }
    wx.downloadFile({
      filePath: 'headless://temp/component-lab-download-no-mock.txt',
      url: 'https://mock.mpcore.dev/files/component-lab-unmatched-report.txt',
      fail: (error) => {
        state.downloadNoMockError = error.message
      },
      complete: flush,
    })
    wx.uploadFile({
      url: 'https://mock.mpcore.dev/upload/component-lab-missing-source',
      filePath: 'headless://temp/component-lab-missing-upload.txt',
      name: 'report',
      fail: (error) => {
        state.uploadMissingFileError = error.message
      },
      complete: flush,
    })
    wx.uploadFile({
      url: 'https://mock.mpcore.dev/upload/component-lab-unmatched-report',
      filePath: 'headless://temp/component-lab-upload-no-mock.txt',
      name: 'report',
      fail: (error) => {
        state.uploadNoMockError = error.message
      },
      complete: flush,
    })
  },
  runSaveFileMissingTempLab() {
    wx.saveFile({
      tempFilePath: 'headless://temp/component-lab-missing-save-source.txt',
      fail: (error) => {
        this.setData({
          saveFileMissingTempInfo: JSON.stringify({
            missingTempSaveError: error.message,
          }),
        }, () => {
          this.push('lab:runSaveFileMissingTempLab')
        })
      },
    })
  },
  runSavedOverwriteLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/component-lab-first.txt', 'first')
    fsManager.writeFileSync('headless://temp/component-lab-second.txt', 'second-version')
    wx.saveFile({
      tempFilePath: 'headless://temp/component-lab-first.txt',
      filePath: 'headless://saved/component-lab/snapshots/report.txt',
      success: (firstSaveResult) => {
        wx.getSavedFileInfo({
          filePath: firstSaveResult.savedFilePath,
          success: (beforeInfo) => {
            wx.saveFile({
              tempFilePath: 'headless://temp/component-lab-second.txt',
              filePath: firstSaveResult.savedFilePath,
              success: () => {
                wx.getSavedFileInfo({
                  filePath: firstSaveResult.savedFilePath,
                  success: (afterInfo) => {
                    this.setData({
                      savedOverwriteInfo: JSON.stringify({
                        afterCreateTime: afterInfo.createTime,
                        afterSize: afterInfo.size,
                        beforeCreateTime: beforeInfo.createTime,
                        filePath: firstSaveResult.savedFilePath,
                      }),
                    }, () => {
                      this.push('lab:runSavedOverwriteLab')
                    })
                  }
                })
              }
            })
          }
        })
      }
    })
  },
  runSavedCopyOverwriteLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/component-lab-copy-source.txt', 'alpha-beta')
    fsManager.writeFileSync('headless://temp/component-lab-copy-target.txt', 'x')
    wx.saveFile({
      tempFilePath: 'headless://temp/component-lab-copy-target.txt',
      filePath: 'headless://saved/component-lab/copies/target.txt',
      success: () => {
        const beforeInfo = wx.getSavedFileInfo({ filePath: 'headless://saved/component-lab/copies/target.txt' })
        fsManager.copyFileSync(
          'headless://temp/component-lab-copy-source.txt',
          'headless://saved/component-lab/copies/target.txt',
        )
        const afterInfo = wx.getSavedFileInfo({ filePath: 'headless://saved/component-lab/copies/target.txt' })
        this.setData({
          savedCopyOverwriteInfo: JSON.stringify({
            afterCreateTime: afterInfo.createTime,
            afterSize: afterInfo.size,
            beforeCreateTime: beforeInfo.createTime,
            filePath: 'headless://saved/component-lab/copies/target.txt',
          }),
        }, () => {
          this.push('lab:runSavedCopyOverwriteLab')
        })
      },
    })
  },
  runSavedOrderingLab() {
    const root = 'headless://saved/component-lab/ordering'
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/component-lab-order-zeta.txt', 'zeta')
    fsManager.writeFileSync('headless://temp/component-lab-order-alpha.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/component-lab-order-zeta.txt',
      filePath: `${root}/zeta.txt`,
      success: () => {
        wx.saveFile({
          tempFilePath: 'headless://temp/component-lab-order-alpha.txt',
          filePath: `${root}/alpha.txt`,
          success: () => {
            const orderedFiles = wx.getSavedFileList().fileList
              .filter(file => file.filePath.startsWith(`${root}/`))
            this.setData({
              savedOrderingInfo: JSON.stringify({
                createTimesArePositive: orderedFiles.every(file => file.createTime > 0),
                filePaths: orderedFiles.map(file => file.filePath),
              }),
            }, () => {
              this.push('lab:runSavedOrderingLab')
            })
          },
        })
      },
    })
  },
  runSavedRenameOutLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/component-lab-rename-out.txt', 'rename-out')
    wx.saveFile({
      tempFilePath: 'headless://temp/component-lab-rename-out.txt',
      filePath: 'headless://saved/component-lab/transfers/rename-out.txt',
      success: (saveResult) => {
        fsManager.renameSync(saveResult.savedFilePath, 'headless://temp/component-lab-renamed.txt')
        const remainingSavedFiles = wx.getSavedFileList().fileList
        this.setData({
          savedRenameOutInfo: JSON.stringify({
            hasSavedRegistration: remainingSavedFiles.some(file => file.filePath === saveResult.savedFilePath),
            movedText: fsManager.readFileSync('headless://temp/component-lab-renamed.txt'),
            remainingSavedFiles,
          }),
        }, () => {
          this.push('lab:runSavedRenameOutLab')
        })
      }
    })
  },
  runSavedRenameOverwriteLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/component-lab-rename-source.txt', 'alpha-beta')
    fsManager.writeFileSync('headless://temp/component-lab-rename-target.txt', 'x')
    wx.saveFile({
      tempFilePath: 'headless://temp/component-lab-rename-source.txt',
      filePath: 'headless://saved/component-lab/transfers/source.txt',
      success: () => {
        wx.saveFile({
          tempFilePath: 'headless://temp/component-lab-rename-target.txt',
          filePath: 'headless://saved/component-lab/transfers/target.txt',
          success: () => {
            const beforeInfo = wx.getSavedFileInfo({ filePath: 'headless://saved/component-lab/transfers/target.txt' })
            fsManager.renameSync(
              'headless://saved/component-lab/transfers/source.txt',
              'headless://saved/component-lab/transfers/target.txt',
            )
            const afterInfo = wx.getSavedFileInfo({ filePath: 'headless://saved/component-lab/transfers/target.txt' })
            this.setData({
              savedRenameOverwriteInfo: JSON.stringify({
                afterCreateTime: afterInfo.createTime,
                afterSize: afterInfo.size,
                beforeCreateTime: beforeInfo.createTime,
                filePath: 'headless://saved/component-lab/transfers/target.txt',
              }),
            }, () => {
              this.push('lab:runSavedRenameOverwriteLab')
            })
          },
        })
      },
    })
  },
  runSavedRemovalLab() {
    const filePath = 'headless://saved/component-lab/removals/report.txt'
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/component-lab-remove.txt', 'remove-me')
    wx.saveFile({
      tempFilePath: 'headless://temp/component-lab-remove.txt',
      filePath,
      success: (saveResult) => {
        wx.removeSavedFile({
          filePath: saveResult.savedFilePath,
          success: (removeResult) => {
            wx.getSavedFileInfo({
              filePath: saveResult.savedFilePath,
              fail: (error) => {
                let postRemovalReadError = ''
                try {
                  fsManager.readFileSync(saveResult.savedFilePath)
                }
                catch (readError) {
                  postRemovalReadError = readError.message
                }
                const remainingSavedFiles = wx.getSavedFileList().fileList
                this.setData({
                  savedRemovalInfo: JSON.stringify({
                    hasSavedRegistration: remainingSavedFiles.some(file => file.filePath === saveResult.savedFilePath),
                    missingInfoError: error.message,
                    removeErrMsg: removeResult.errMsg,
                  }),
                  savedPostRemovalReadInfo: JSON.stringify({
                    postRemovalReadError,
                  }),
                }, () => {
                  this.push('lab:runSavedRemovalLab')
                })
              },
            })
          },
        })
      },
    })
  },
  runSavedMissingInfoLab() {
    wx.getSavedFileInfo({
      filePath: 'headless://saved/component-lab/missing-info/report.txt',
      fail: (error) => {
        this.setData({
          savedMissingInfo: JSON.stringify({
            missingInfoError: error.message,
          }),
        }, () => {
          this.push('lab:runSavedMissingInfoLab')
        })
      },
    })
  },
  runSavedMissingRemovalLab() {
    wx.removeSavedFile({
      filePath: 'headless://saved/component-lab/removals/missing.txt',
      fail: (error) => {
        this.setData({
          savedMissingRemovalInfo: JSON.stringify({
            missingRemoveError: error.message,
          }),
        }, () => {
          this.push('lab:runSavedMissingRemovalLab')
        })
      },
    })
  },
  runMissingStatLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.stat({
      path: 'headless://saved/component-lab/missing-stat/report.txt',
      fail: (error) => {
        this.setData({
          fileManagerMissingStatInfo: JSON.stringify({
            missingStatError: error.message,
          }),
        }, () => {
          this.push('lab:runMissingStatLab')
        })
      },
    })
  },
  runMissingReadDirLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.readdir({
      dirPath: 'headless://saved/component-lab/missing-directory',
      fail: (error) => {
        this.setData({
          fileManagerMissingReadDirInfo: JSON.stringify({
            missingReadDirError: error.message,
          }),
        }, () => {
          this.push('lab:runMissingReadDirLab')
        })
      },
    })
  },
  runMissingReadFileLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.readFile({
      filePath: 'headless://saved/component-lab/missing-file.txt',
      fail: (error) => {
        this.setData({
          fileManagerMissingReadInfo: JSON.stringify({
            missingReadError: error.message,
          }),
        }, () => {
          this.push('lab:runMissingReadFileLab')
        })
      },
    })
  },
  runMissingUnlinkLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.unlink({
      filePath: 'headless://saved/component-lab/missing-unlink.txt',
      fail: (error) => {
        this.setData({
          fileManagerMissingUnlinkInfo: JSON.stringify({
            missingUnlinkError: error.message,
          }),
        }, () => {
          this.push('lab:runMissingUnlinkLab')
        })
      },
    })
  },
  runMissingCopyFileLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.copyFile({
      srcPath: 'headless://saved/component-lab/missing-copy-source.txt',
      destPath: 'headless://saved/component-lab/missing-copy-target.txt',
      fail: (error) => {
        this.setData({
          fileManagerMissingCopyInfo: JSON.stringify({
            missingCopyError: error.message,
          }),
        }, () => {
          this.push('lab:runMissingCopyFileLab')
        })
      },
    })
  },
  runMissingMkdirLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.mkdir({
      dirPath: 'headless://saved/component-lab/missing-parent/child',
      recursive: false,
      fail: (error) => {
        this.setData({
          fileManagerMissingMkdirInfo: JSON.stringify({
            missingMkdirError: error.message,
          }),
        }, () => {
          this.push('lab:runMissingMkdirLab')
        })
      },
    })
  },
  runMissingRenameLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.rename({
      oldPath: 'headless://saved/component-lab/missing-rename-source.txt',
      newPath: 'headless://saved/component-lab/missing-rename-target.txt',
      fail: (error) => {
        this.setData({
          fileManagerMissingRenameInfo: JSON.stringify({
            missingRenameError: error.message,
          }),
        }, () => {
          this.push('lab:runMissingRenameLab')
        })
      },
    })
  },
  runMissingRmdirLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.rmdir({
      dirPath: 'headless://saved/component-lab/missing-directory-remove',
      recursive: true,
      fail: (error) => {
        this.setData({
          fileManagerMissingRmdirInfo: JSON.stringify({
            missingRmdirError: error.message,
          }),
        }, () => {
          this.push('lab:runMissingRmdirLab')
        })
      },
    })
  },
  runMissingAccessLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.access({
      path: 'headless://saved/component-lab/missing-access.txt',
      fail: (error) => {
        this.setData({
          fileManagerMissingAccessInfo: JSON.stringify({
            missingAccessError: error.message,
          }),
        }, () => {
          this.push('lab:runMissingAccessLab')
        })
      },
    })
  },
  runUnsupportedWriteEncodingLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFile({
      filePath: 'headless://saved/component-lab/unsupported-write.txt',
      data: 'payload',
      encoding: 'latin1',
      fail: (error) => {
        this.setData({
          fileManagerUnsupportedWriteEncodingInfo: JSON.stringify({
            unsupportedWriteEncodingError: error.message,
          }),
        }, () => {
          this.push('lab:runUnsupportedWriteEncodingLab')
        })
      },
    })
  },
  runUnsupportedAppendEncodingLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.appendFile({
      filePath: 'headless://saved/component-lab/unsupported-append.txt',
      data: 'payload',
      encoding: 'latin1',
      fail: (error) => {
        this.setData({
          fileManagerUnsupportedAppendEncodingInfo: JSON.stringify({
            unsupportedAppendEncodingError: error.message,
          }),
        }, () => {
          this.push('lab:runUnsupportedAppendEncodingLab')
        })
      },
    })
  },
  runUnsupportedReadEncodingLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://saved/component-lab/unsupported-read.txt', 'payload')
    fsManager.readFile({
      filePath: 'headless://saved/component-lab/unsupported-read.txt',
      encoding: 'latin1',
      fail: (error) => {
        this.setData({
          fileManagerUnsupportedReadEncodingInfo: JSON.stringify({
            unsupportedReadEncodingError: error.message,
          }),
        }, () => {
          this.push('lab:runUnsupportedReadEncodingLab')
        })
      },
    })
  },
  runFileManagerLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.mkdirSync('headless://saved/component-lab/reports/daily', true)
    fsManager.writeFileSync('headless://saved/component-lab/reports/daily/report.txt', 'component')
    fsManager.appendFileSync('headless://saved/component-lab/reports/daily/report.txt', '-lab')
    fsManager.mkdirSync('headless://saved/component-lab/archive/obsolete', true)
    fsManager.writeFileSync('headless://saved/component-lab/archive/obsolete/report.txt', 'archive')
    fsManager.rmdirSync('headless://saved/component-lab/archive', true)
    let archiveRemoved = false
    try {
      fsManager.statSync('headless://saved/component-lab/archive')
    }
    catch {
      archiveRemoved = true
    }
    this.setData({
      directorySnapshot: JSON.stringify(fsManager.readdirSync('headless://saved/component-lab/reports')),
      fileManagerSnapshot: JSON.stringify({
        archiveRemoved,
        isDirectory: fsManager.statSync('headless://saved/component-lab/reports/daily').isDirectory(),
        isFile: fsManager.statSync('headless://saved/component-lab/reports/daily/report.txt').isFile(),
        text: fsManager.readFileSync('headless://saved/component-lab/reports/daily/report.txt'),
      }),
    }, () => {
      this.push('lab:runFileManagerLab')
    })
  },
  storeSnapshot() {
    const payload = {
      count: this.data.count,
      status: this.data.status,
    }
    wx.setStorageSync('component-lab', payload)
    this.setData({
      storageSnapshot: JSON.stringify(wx.getStorageSync('component-lab')),
    }, () => {
      this.push('lab:storeSnapshot')
    })
  },
  toastSnapshot() {
    wx.showToast({
      title: `status:${this.data.status}`,
      success: (result) => {
        this.setData({
          toastState: result?.errMsg ?? 'showToast:unknown',
        })
      },
      complete: () => {
        this.push('lab:toastSnapshot')
      }
    })
  },
  inspectCard() {
    const card = this.selectComponent?.('#status-card')
    const cards = this.selectAllComponents?.('status-card') ?? []
    this.setData({
      componentSnapshot: JSON.stringify({
        count: card?.properties?.count,
        methods: typeof card?.pulse === 'function',
        size: cards.length,
      }),
    })
    this.push('lab:inspectCard')
  },
  inspectCompoundCard() {
    const card = this.selectComponent?.('status-card.primary-card[data-role="main"]')
    const cards = this.selectAllComponents?.('status-card.primary-card[data-role="main"]') ?? []
    this.setData({
      compoundComponentSnapshot: JSON.stringify({
        count: card?.properties?.count,
        status: card?.properties?.status ?? '',
        size: cards.length,
      }),
    }, () => {
      this.push('lab:inspectCompoundCard')
    })
  },
  inspectCompoundSelector() {
    const card = this.selectComponent?.('#status-card')
    wx.createSelectorQuery()
      .in(card)
      .select('view.panel-row[data-phase="pulse"]')
      .fields({
        dataset: true,
        id: true,
      }, (result) => {
        this.setData({
          compoundSelectorSnapshot: JSON.stringify(result),
        }, () => {
          this.push('lab:inspectCompoundSelector')
        })
      })
      .exec()
  },
})
