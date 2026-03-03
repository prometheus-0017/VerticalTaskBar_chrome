console.log('hlllo')
chrome.runtime.onInstalled.addListener(() => {
  console.log("服务已启动，正在连接外部控制源...");
  
  // 选择一种模式启动
  startPolling(); 
  // startWebSocket(); // 如果需要实时性，取消注释并配置服务器
});



