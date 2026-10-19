const {contextBridge,ipcRenderer}=require('electron');

const startup = {
  retry: () => {
    ipcRenderer.send('phoenix-startup-retry');
  },
  ready: () => {
    ipcRenderer.send('phoenix-classroom-ready');
  }
};

const deviceLibrary = {
  onFlush: callback => {
    const listener = () => callback().finally(() => {
      ipcRenderer.send('phoenix-device-close-ready');
    });
    ipcRenderer.on('phoenix-device-flush', listener);
    return () => {
      ipcRenderer.removeListener('phoenix-device-flush', listener);
    };
  },
  status: () => ipcRenderer.invoke('phoenix-device-status'),
  choose: () => ipcRenderer.invoke('phoenix-device-choose'),
  read: () => ipcRenderer.invoke('phoenix-device-read'),
  write: data => ipcRenderer.invoke('phoenix-device-write', data)
};

const display = {
  start: () => ipcRenderer.invoke('phoenix-display-start'),
  command: (action, value) => ipcRenderer.invoke('phoenix-display-command', action, value),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('phoenix-display-state', listener);
    return () => {
      ipcRenderer.removeListener('phoenix-display-state', listener);
    };
  }
};

contextBridge.exposeInMainWorld('phoenixStartup', startup);
contextBridge.exposeInMainWorld('phoenixDeviceLibrary', deviceLibrary);
contextBridge.exposeInMainWorld('phoenixDisplay', display);
