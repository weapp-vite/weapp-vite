import { areaData } from '../config/index'

export function addressParse(provinceName: string, cityName: string, countryName: string) {
  return new Promise<{
    provinceCode: string
    cityCode: string
    districtCode: string
  }>((resolve, reject) => {
    try {
      const province = areaData.find(v => v.label === provinceName)
      if (!province) {
        throw new Error('province not found')
      }
      const { value: provinceCode } = province
      const city = province.children.find(v => v.label === cityName)
      if (!city) {
        throw new Error('city not found')
      }
      const { value: cityCode } = city
      const country = city.children.find(v => v.label === countryName)
      if (!country) {
        throw new Error('country not found')
      }
      const { value: districtCode } = country
      resolve({
        provinceCode,
        cityCode,
        districtCode,
      })
    }
    catch (error) {
      reject('地址解析失败')
    }
  })
}
