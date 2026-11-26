import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type NextUpApi } from '../shared/api'

function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T): void => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: NextUpApi = {
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot),
  rescan: () => ipcRenderer.invoke(IPC.rescan),
  sync: () => ipcRenderer.invoke(IPC.sync),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),
  setApiKey: (key) => ipcRenderer.invoke(IPC.setApiKey, key),
  clearApiKey: () => ipcRenderer.invoke(IPC.clearApiKey),
  chooseSteamFolder: () => ipcRenderer.invoke(IPC.chooseSteamFolder),
  resetSteamFolder: () => ipcRenderer.invoke(IPC.resetSteamFolder),
  launchGame: (appid) => ipcRenderer.invoke(IPC.launchGame, appid),
  installGame: (appid) => ipcRenderer.invoke(IPC.installGame, appid),
  openStorePage: (appid) => ipcRenderer.invoke(IPC.openStorePage, appid),
  openLink: (link) => ipcRenderer.invoke(IPC.openLink, link),
  clearDownloads: () => ipcRenderer.invoke(IPC.clearDownloads),
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  setTheme: (theme) => ipcRenderer.invoke(IPC.setTheme, theme),
  onSnapshot: (callback) => subscribe(IPC.snapshotUpdated, callback),
  onSyncProgress: (callback) => subscribe(IPC.syncProgress, callback)
}

contextBridge.exposeInMainWorld('api', api)
