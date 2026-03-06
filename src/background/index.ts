import { getWindowsManager } from './WindowsManager';
console.log('hlllo')


// Initialize WindowsManager
let windowsManager: any;
//尤其注意不要在全局上执行初始化逻辑。
async function init(){
  windowsManager = await getWindowsManager();
}

chrome.tabs.onCreated.addListener((tab) => {
  console.log('new tab', tab)
})

chrome.runtime.onInstalled.addListener(() => {
  console.log("服务已启动，正在连接外部控制源...");
  init();
});
