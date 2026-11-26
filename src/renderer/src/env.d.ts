/// <reference types="vite/client" />
import type { NextUpApi } from '@shared/api'

declare global {
  interface Window {
    api: NextUpApi
  }
}

export {}
