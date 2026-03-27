Page({
  data: {
    title: 'Component Lab',
    cardTitle: 'Queue health',
    status: 'stable',
    count: 3,
    events: [],
    eventShape: '',
    componentSnapshot: '',
    directorySnapshot: '',
    downloadSnapshot: '',
    fileManagerSnapshot: '',
    requestSnapshot: '',
    savedOverwriteInfo: '',
    savedFilePath: '',
    savedFileInfo: '',
    savedMissingInfo: '',
    savedMissingRemovalInfo: '',
    fileManagerMissingReadInfo: '',
    fileManagerMissingReadDirInfo: '',
    fileManagerMissingStatInfo: '',
    savedOrderingInfo: '',
    savedRemovalInfo: '',
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
                const remainingSavedFiles = wx.getSavedFileList().fileList
                this.setData({
                  savedRemovalInfo: JSON.stringify({
                    hasSavedRegistration: remainingSavedFiles.some(file => file.filePath === saveResult.savedFilePath),
                    missingInfoError: error.message,
                    removeErrMsg: removeResult.errMsg,
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
})
