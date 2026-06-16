import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiBaseURL } from '@/enums'

export type HttpResponseData<T = any> = T

export const createHttp = (baseURL: ApiBaseURL | string) => {
  const normalizedBaseUrl = String(baseURL || '')
  const isAbsoluteBaseUrl = /^https?:\/\//i.test(normalizedBaseUrl)
  const service = axios.create({
    baseURL,
    withCredentials: !isAbsoluteBaseUrl,
    timeout: 180000,
  })

  service.interceptors.response.use(
    (response: AxiosResponse<HttpResponseData>) => {
      const res = response.data
      return res
    },
    (error) => {
      return Promise.reject(error)
    },
  )
  return {
    get<T>(config: AxiosRequestConfig): Promise<HttpResponseData<T>> {
      return service({
        ...config,
        method: 'GET',
      })
    },
    post<T>(config: AxiosRequestConfig): Promise<HttpResponseData<T>> {
      return service({
        ...config,
        method: 'POST',
      })
    },
  }
}
