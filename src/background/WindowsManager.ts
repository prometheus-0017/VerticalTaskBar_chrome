/**
你在写一个chrome 插件
编写一个WindowsManager，用于管理tab变更，hook所有的tab变更事件，对应生成一个变更通知事项，内容参考：
WindowChangeInfo(
        type='delete',
        data=WindowProxyDTO(
            processId=v.getProcess(),
            id=v.getId(),
            pwd=v.getPwd(),
            system='win',
            originalName=v.getTitle(),
            modifiedName=v.getTitle(),
            processName=v.getProcessFileName(),
            originalIcon=v.getIconPath(),
            modifiedIcon=v.getIconPath()
        ) 
这个事项通过await rpc.notify(info)发送

实现一个setTop(id) 方法，将当前窗口置顶，然后将id对应的tab置顶
这里的id是tab的id

另外实现一个随机uuid方法

实现一个sync 方法，返回全部的tab信息，格式为WindowProxyDTO[]

        
 */
// WindowProxyDTO interface
interface WindowProxyDTO {
  processId: string;
  id: string;
  pwd?: string;
  system: string,
  originalName: string;
  modifiedName: string;
  processName?: string;
  originalIcon?: string;
  modifiedIcon?: string;
}

// WindowChangeInfo interface
interface WindowChangeInfo {
  type: 'add' | 'delete' | 'update' | 'activate';
  data: WindowProxyDTO;
}
 /**
   * Generate a random UUID
   */
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
//rpc 不了class是不是有点奇怪？
class WindowsManager {
  private tabs: Map<number, WindowProxyDTO> = new Map();
  private rpc: Rpc;

  constructor(rpc: Rpc) {
    this.rpc = rpc;
    this.initializeTabListeners();
  }
  

  async getHost(){
    return hostId
  }

  /**
   * Initialize tab change event listeners
   */
  private initializeTabListeners() {
    // Listen for tab creation
    chrome.tabs.onCreated.addListener((tab) => {
      const windowProxy = this.createWindowProxy(tab);
      this.tabs.set(tab.id!, windowProxy);
      
      this.sendNotification({
        type: 'add',
        data: windowProxy
      });
    });

    // Listen for tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      const windowProxy = this.tabs.get(tabId);
      if (windowProxy) {
        this.sendNotification({
          type: 'delete',
          data: windowProxy
        });
        this.tabs.delete(tabId);
      }
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
      const oldWindowProxy = this.tabs.get(tabId);
      if (oldWindowProxy) {
        const updatedWindowProxy = this.createWindowProxy(tab);
        this.tabs.set(tabId, updatedWindowProxy);
        
        this.sendNotification({
          type: 'update',
          data: updatedWindowProxy
        });
      }
    });

    // Listen for tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      const windowProxy = this.tabs.get(activeInfo.tabId);
      if (windowProxy) {
        this.sendNotification({
          type: 'activate',
          data: windowProxy
        });
      }
    });
  }

  /**
   * Create a WindowProxyDTO from a Chrome tab
   */
  private createWindowProxy(tab: chrome.tabs.Tab): WindowProxyDTO {
    return {
      processId: '0',
      id: ''+tab.id!,
      pwd: tab.url,
      system: hostId,
      originalName: tab.title || '',
      modifiedName: tab.title || '',
      processName: tab.url ? new URL(tab.url).hostname : undefined,
      originalIcon: tab.favIconUrl,
      modifiedIcon: tab.favIconUrl
    };
  }

  /**
   * Send notification via RPC
   */
  private async sendNotification(info: WindowChangeInfo) {
    try {
      await this.rpc.notify(info);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Set a tab as topmost by bringing its window to front
   * @param tabId - The ID of the tab to set as topmost
   */
  async toTop(tabId0: string) {
    try {
      let tabId=parseInt(tabId0)
      // Get the tab
      const tab = await chrome.tabs.get(tabId);
      
      if (tab.windowId !== undefined) {
        // Bring the window to front
        await chrome.windows.update(tab.windowId, { focused: true });
        
        // Focus the tab
        await chrome.tabs.update(tabId, { active: true });
        
        console.log(`Tab ${tabId} set to top`);
      } else {
        console.error(`Window ID not found for tab ${tabId}`);
      }
    } catch (error) {
      console.error(`Failed to set tab ${tabId0} to top:`, error);
      throw error;
    }
  }

  /**
   * Sync and return all tab information
   * @returns Array of WindowProxyDTO for all current tabs
   */
  async sync(): Promise<WindowProxyDTO[]> {
    try {
      // Get all windows with their tabs
      const windows = await chrome.windows.getAll({ populate: true });
      
      const allTabs: WindowProxyDTO[] = [];
      
      for (const window of windows) {
        if (window.tabs) {
          for (const tab of window.tabs) {
            const windowProxy = this.createWindowProxy(tab);
            this.tabs.set(tab.id!, windowProxy);
            allTabs.push(windowProxy);
          }
        }
      }
      
      return allTabs;
    } catch (error) {
      console.error('Failed to sync tabs:', error);
      return [];
    }
  }

  /**
   * Get cached tabs
   */
  getCachedTabs(): Map<number, WindowProxyDTO> {
    return new Map(this.tabs);
  }
}

// Export for use in background script
export { WindowsManager, type WindowProxyDTO, type WindowChangeInfo };

import { type MessageReceiverOptions,PlainProxyManager,RunnableProxyManager,MessageReceiver,Client,asProxy,getMessageReceiver,setHostId,type ISender, type Message } from 'xuri-rpc'
import { setDebugFlag } from 'xuri-rpc/dist/rpc';
import { WebSocketConnectionKeeper,WebSocketSender } from 'xuri-rpc'

// setDebugFlag(true)

let hostId='taskbar-chrome-'+generateUUID()
setHostId(hostId)

let client=new Client()
//这么写是不合适的，但是我不确定meta机制是否完善
class SenderDecorator implements ISender{
  sender:ISender
  constructor(sender:ISender){
    this.sender=sender
  }
  send(message: any) {
    if(!message.meta){
      message.meta={
      }
    }
    message.meta.hostId=hostId
    return this.sender.send(message)
  }
}
let sender:ISender|null=null

interface Rpc{
  notify: (info: WindowChangeInfo) => Promise<void>;
  loginChrome(chromeProxy:any|WindowsManager):Promise<void>;
  echo():Promise<void>;
}
let rpc:Rpc|null=null
import ReconnectingWebSocket from 'reconnecting-websocket';

async function  getSenderForDebug(client:Client) {
  let socket=new ReconnectingWebSocket('ws://localhost:18765')
  socket.onmessage=async (e)=>{ 
    await getMessageReceiver().onReceiveMessage(JSON.parse(e.data),client)
  }
  let res=new Promise((resolve)=>{
    socket.onopen=()=>{
      resolve(true)
    }
  })
  await res
  class MySender implements ISender{
    send(message: any) {
      console.log('message')
      socket.send(JSON.stringify(message))
    }
  }
  return new MySender()
  
}
export async function prepareRpc(){
  // sender=new WebSocketSender(new WebSocketConnectionKeeper('localhost'||window.location.hostname,18765,'/',client))
  sender=await getSenderForDebug(client)//没绷住 是wait时序问题吗
  sender=new SenderDecorator(sender)
  client.setSender(sender)
  await new Promise(resolve=>{
    setTimeout(resolve,1000)
  })
  console.log('[v]connected')
  try{
    rpc=await client.getObject('rpc') as Rpc
  }catch(e){
    console.error(e)
  }
}

let windowsManager:WindowsManager|null=null
export async function getWindowsManager(){
  if(windowsManager!=null){
    return windowsManager
  }

  if(rpc==null){
    await prepareRpc()
  }
//nmd 之前没有js当服务方的例子，这个await是不是不对啊
  windowsManager=new WindowsManager(rpc!)

  const login=async ()=>{
    await rpc!.loginChrome(asProxy({
      sync:async ()=>{
        let res=await windowsManager!.sync()
        return res
      },
      getHost:async ()=>{ 
        let res=await windowsManager?.getHost()
        return res
      },
      toTop:windowsManager!.toTop,
    }))
  }

  await login()

  setInterval(async ()=>{
    await login()
  },1500)

  return windowsManager
}
