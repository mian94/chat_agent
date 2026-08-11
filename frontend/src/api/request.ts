/**
 * Axios 请求封装
 * 统一处理请求拦截、响应拦截、错误处理
 */
import axios from 'axios';
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { data } = response;
    if (data.success) {
      return response;
    }
    return Promise.reject(new Error(data.error || data.message || '请求失败'));
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('请求超时');
    } else if (!error.response) {
      console.error('网络错误，无法连接到服务器');
    } else {
      const status = error.response.status;
      if (status >= 500) {
        console.error('服务器内部错误');
      } else if (status === 404) {
        console.error('请求的资源不存在');
      }
    }
    return Promise.reject(error);
  },
);

export default request;
