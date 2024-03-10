chrome.tabs.onRemoved.addListener(function (tabId) {
	chrome.storage.session.get(sessionStorage => {
		let tabIndex = sessionStorage.enabled && sessionStorage.enabled.includes(tabId);
		let tabConfig = sessionStorage[tabId];
		if (!tabIndex && !tabConfig) return;
		tabIndex && sessionStorage.enabled.splice(tabIndex, 1);
		tabConfig && delete sessionStorage[tabId];
		chrome.storage.session.set(sessionStorage);
	});
});