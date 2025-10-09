import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { message } from 'ant-design-vue'
import { apiBaseURL } from '@/enums'
import { HttpResponseCode } from '@/enums/httpCode'

export type HttpResponseData<T = any> = T

export const createHttp = (baseURL: apiBaseURL) => {
  const service = axios.create({
    baseURL,
    withCredentials: true,
    timeout: 60000,
  })

  service.interceptors.response.use(
    // @ts-expect-error
    (response: AxiosResponse<HttpResponseData>) => {
      const res = response.data
      return res
    },
    (error) => {
      message.error(JSON.stringify(error))
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
