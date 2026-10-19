const {contextBridge,ipcRenderer}=require('electron');

const startup = {
  retry: () => {
    ipcRenderer.send('phoenix-startup-retry');
    ipcRenderer.send('kopy-startup-retry');
  },
  ready: () => {
    ipcRenderer.send('phoenix-classroom-ready');
    ipcRenderer.send('kopy-classroom-ready');
  }
};

const deviceLibrary = {
  onFlush: callback => {
    const listener = () => callback().finally(() => {
      ipcRenderer.send('phoenix-device-close-ready');
      ipcRenderer.send('kopy-device-close-ready');
    });
    ipcRenderer.on('phoenix-device-flush', listener);
    ipcRenderer.on('kopy-device-flush', listener);
    return () => {
      ipcRenderer.removeListener('phoenix-device-flush', listener);
      ipcRenderer.removeListener('kopy-device-flush', listener);
    };
  },
  status: () => ipcRenderer.invoke('phoenix-device-status').catch(() => ipcRenderer.invoke('kopy-device-status')),
  choose: () => ipcRenderer.invoke('phoenix-device-choose').catch(() => ipcRenderer.invoke('kopy-device-choose')),
  read: () => ipcRenderer.invoke('phoenix-device-read').catch(() => ipcRenderer.invoke('kopy-device-read')),
  write: data => ipcRenderer.invoke('phoenix-device-write', data).catch(() => ipcRenderer.invoke('kopy-device-write', data))
};

const display = {
  start: () => ipcRenderer.invoke('phoenix-display-start').catch(() => ipcRenderer.invoke('kopy-display-start')),
  command: (action, value) => ipcRenderer.invoke('phoenix-display-command', action, value).catch(() => ipcRenderer.invoke('kopy-display-command', action, value)),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('phoenix-display-state', listener);
    ipcRenderer.on('kopy-display-state', listener);
    return () => {
      ipcRenderer.removeListener('phoenix-display-state', listener);
      ipcRenderer.removeListener('kopy-display-state', listener);
    };
  }
};

contextBridge.exposeInMainWorld('phoenixStartup', startup);
contextBridge.exposeInMainWorld('phoenixDeviceLibrary', deviceLibrary);
contextBridge.exposeInMainWorld('phoenixDisplay', display);

// Legacy bridge compatibility
contextBridge.exposeInMainWorld('kopyStartup', startup);
contextBridge.exposeInMainWorld('kopyDeviceLibrary', deviceLibrary);
contextBridge.exposeInMainWorld('kopyDisplay', display);
