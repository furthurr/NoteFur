// Service worker: configura el Side Panel para que se abra al hacer clic en el ícono.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
