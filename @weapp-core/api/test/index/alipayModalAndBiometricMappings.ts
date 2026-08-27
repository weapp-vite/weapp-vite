import { createTestWeapi } from '../helpers/createTestWeapi'

export function registerWeapiIndexAlipayModalAndBiometricMappingsTests() {
  it('maps showModal to confirm for alipay', async () => {
    const confirm = vi.fn((options: any) => {
      options.success?.({ confirm: false })
    })
    const api = createTestWeapi({
      adapter: {
        confirm,
      },
      platform: 'alipay',
    })

    const result = await api.showModal({
      title: '提示',
      content: '是否继续',
      confirmText: '继续',
      cancelText: '取消',
    })

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: '提示',
      content: '是否继续',
      confirmText: '继续',
      cancelText: '取消',
      confirmButtonText: '继续',
      cancelButtonText: '取消',
    }))
    expect(result).toMatchObject({
      confirm: false,
      cancel: true,
      content: '',
    })
  })

  it('treats showModal as unsupported for alipay when showCancel is false', async () => {
    const confirm = vi.fn()
    const api = createTestWeapi({
      adapter: {
        confirm,
      },
      platform: 'alipay',
    })

    await expect(api.showModal({
      title: '提示',
      content: '仅确定按钮',
      showCancel: false,
    })).rejects.toMatchObject({
      errMsg: 'my.showModal:fail method not supported',
    })

    expect(confirm).not.toHaveBeenCalled()
  })

  it('calls fail/complete when alipay showModal uses unsupported editable options', () => {
    const confirm = vi.fn()
    const fail = vi.fn()
    const complete = vi.fn()
    const success = vi.fn()
    const api = createTestWeapi({
      adapter: {
        confirm,
      },
      platform: 'alipay',
    })

    const result = api.showModal({
      title: '请输入',
      editable: true,
      placeholderText: '请输入内容',
      success,
      fail,
      complete,
    })

    expect(result).toBeUndefined()
    expect(success).not.toHaveBeenCalled()
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: 'my.showModal:fail method not supported',
    }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: 'my.showModal:fail method not supported',
    }))
    expect(confirm).not.toHaveBeenCalled()
  })

  it('maps chooseImage result from apFilePaths to tempFilePaths', async () => {
    const api = createTestWeapi({
      adapter: {
        chooseImage(options: any) {
          options.success?.({ apFilePaths: ['/tmp/demo.png'] })
        },
      },
      platform: 'alipay',
    })

    const result = await api.chooseImage()
    expect(result).toMatchObject({
      apFilePaths: ['/tmp/demo.png'],
      tempFilePaths: ['/tmp/demo.png'],
    })
  })

  it('maps checkIsSoterEnrolledInDevice to strict-equivalent alipay ifaa api', async () => {
    const checkIsIfaaEnrolledInDevice = vi.fn((options: any) => {
      options.success?.({ isEnrolled: true, success: true })
    })
    const api = createTestWeapi({
      adapter: {
        checkIsIfaaEnrolledInDevice,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('checkIsSoterEnrolledInDevice')).toMatchObject({
      method: 'checkIsSoterEnrolledInDevice',
      target: 'checkIsIfaaEnrolledInDevice',
      supportLevel: 'mapped',
      supported: true,
      semanticAligned: true,
    })

    const result = await api.checkIsSoterEnrolledInDevice({
      checkAuthMode: 'fingerPrint',
    } as any)

    expect(checkIsIfaaEnrolledInDevice).toHaveBeenCalledWith(expect.objectContaining({
      checkAuthMode: 'fingerPrint',
    }))
    expect(result).toMatchObject({
      success: true,
      isEnrolled: true,
      errMsg: 'checkIsSoterEnrolledInDevice:ok',
    })
  })

  it('treats speech mode as unsupported when mapping checkIsSoterEnrolledInDevice to alipay', async () => {
    const checkIsIfaaEnrolledInDevice = vi.fn()
    const api = createTestWeapi({
      adapter: {
        checkIsIfaaEnrolledInDevice,
      },
      platform: 'alipay',
    })

    await expect(api.checkIsSoterEnrolledInDevice({
      checkAuthMode: 'speech',
    } as any)).rejects.toMatchObject({
      errMsg: 'my.checkIsSoterEnrolledInDevice:fail method not supported',
    })
    expect(checkIsIfaaEnrolledInDevice).not.toHaveBeenCalled()
  })

  it('maps checkIsSupportSoterAuthentication to strict-equivalent alipay ifaa api', async () => {
    const checkIsSupportIfaaAuthentication = vi.fn((options: any) => {
      options.success?.({ supportMode: ['fingerPrint', 'facial'], success: true })
    })
    const api = createTestWeapi({
      adapter: {
        checkIsSupportIfaaAuthentication,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('checkIsSupportSoterAuthentication')).toMatchObject({
      method: 'checkIsSupportSoterAuthentication',
      target: 'checkIsSupportIfaaAuthentication',
      supportLevel: 'mapped',
      supported: true,
      semanticAligned: true,
    })

    const result = await api.checkIsSupportSoterAuthentication()

    expect(checkIsSupportIfaaAuthentication).toHaveBeenCalled()
    expect(result).toMatchObject({
      supportMode: ['fingerPrint', 'facial'],
      success: true,
      errMsg: 'checkIsSupportSoterAuthentication:ok',
    })
  })

  it('treats chooseAddress as unsupported for alipay without strict-equivalent api', async () => {
    const getAddress = vi.fn((options: any) => {
      options.success?.({ provinceName: 'Zhejiang' })
    })
    const api = createTestWeapi({
      adapter: {
        getAddress,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('chooseAddress')).toMatchObject({
      method: 'chooseAddress',
      target: 'chooseAddress',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.chooseAddress()).rejects.toMatchObject({
      errMsg: 'my.chooseAddress:fail method not supported',
    })
    expect(getAddress).not.toHaveBeenCalled()
  })

  it('treats getWeRunData as unsupported for alipay without strict-equivalent api', async () => {
    const getRunData = vi.fn((options: any) => {
      options.success?.({ response: '{}' })
    })
    const api = createTestWeapi({
      adapter: {
        getRunData,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('getWeRunData')).toMatchObject({
      method: 'getWeRunData',
      target: 'getWeRunData',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getWeRunData({
      tempFilePath: '/tmp/demo',
    } as any)).rejects.toMatchObject({
      errMsg: 'my.getWeRunData:fail method not supported',
    })
    expect(getRunData).not.toHaveBeenCalled()
  })
}
