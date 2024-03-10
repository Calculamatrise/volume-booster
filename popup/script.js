import "../utils/Storage.js";

const state = document.querySelector('#state');
const gain = document.querySelector('#gain');
const resetSettings = document.querySelector('#reset-settings');
chrome.tabs.query({ active: true, currentWindow: true }).then(([currentTab]) => {
	if (!currentTab) return;
	state.addEventListener('click', async function () {
		if (this.classList.contains('update-available')) {
			return chrome.runtime.reload();
		}

		let tabsEnabled = chrome.storage.proxy.session.get('enabled') || [];
		let tabIndex = tabsEnabled.indexOf(currentTab.id);
		if (tabIndex !== -1) {
			tabsEnabled.splice(tabIndex, 1);
			// chrome.storage.proxy.session.delete(currentTab.id);
			chrome.storage.proxy.session.set(currentTab.id, gain.valueAsNumber);
			chrome.tabs.sendMessage(currentTab.id, { op: 4 });
		} else {
			tabsEnabled.push(currentTab.id);
			let gainValue = chrome.storage.proxy.session.get(currentTab.id);
			gainValue ? (gain.valueAsNumber = gainValue,
			gain.dispatchEvent(new Event('input'))) : chrome.scripting.executeScript({
				func: boostVolume,
				target: { allFrames: true, tabId: currentTab.id }
			}, () => chrome.storage.proxy.session.set(currentTab.id, 150));
		}

		chrome.storage.proxy.session.set('enabled', tabsEnabled);
	});

	gain.addEventListener('change', function () {
		chrome.storage.proxy.session.set(currentTab.id, this.valueAsNumber);
		// chrome.tabs.sendMessage(currentTab.id, { op: 3, data: { value: gain.valueAsNumber } });
	});

	gain.addEventListener('input', function () {
		if (!chrome.storage.proxy.session.has(currentTab.id) || !getState() || this.valueAsNumber === 100) state.click();
		chrome.tabs.sendMessage(currentTab.id, { op: 3, data: { value: this.valueAsNumber } }).then(newValue => {
			this.previousElementSibling.innerText = this.previousElementSibling.innerText.replace(/(?<=\()[^%]+/, newValue);
		}).catch(err => console.warn('input', err.code, err.message) || confirm("The page must be reloaded."));
		// this.previousElementSibling.innerText = this.previousElementSibling.innerText.replace(/(?<=\()[^%]+/, this.value);
	});

	resetSettings.addEventListener('click', function () {
		if (confirm(`Are you sure you'd like to reset all your settings?`)) {
			let tabsEnabled = chrome.storage.proxy.session.get('enabled') || [];
			let currentTabIndex = tabsEnabled.indexOf(currentTab.id);
			currentTabIndex !== -1 && tabsEnabled.splice(currentTabIndex, 1);
			chrome.storage.session.set({ enabled: tabsEnabled }).then(() => {
				alert("Your settings have successfully been reset.");
			});
		}
	});

	chrome.storage.session.onChanged.addListener(({ enabled }) => {
		enabled && setState(-1 !== enabled.newValue.indexOf(currentTab.id));
	});

	chrome.storage.session.get(sessionStorage => {
		let { enabled } = sessionStorage;
		if (enabled) {
			let gainValue = sessionStorage[currentTab.id];
			gainValue && (gain.valueAsNumber = gainValue,
			gain.dispatchEvent(new Event('input')));
			setState(-1 !== enabled.indexOf(currentTab.id));
		}
	});

	function getConfig() {
		return {
			enabled: getState(),
			volume: chrome.storage.proxy.session.get(currentTab.id) ?? 100
		}
	}

	function getIndex() {
		let tabsEnabled = chrome.storage.proxy.session.get('enabled') || [];
		return tabsEnabled.indexOf(currentTab.id);
	}

	function getState() {
		return -1 !== getIndex();
	}

	function setConfig({ enabled, volume } = {}) {
		enabled && chrome.storage.proxy.session.enabled.push(currentTab.id);
		volume && (chrome.storage.proxy.session[currentTab.id] = volume);
	}

	function boostVolume() {
		globalThis.AudioContext ||= window.webkitAudioContext;
		// search for the main video player if multiple exist
		let mediaElements = document.querySelectorAll(":is(audio, video)");
		let media = Array.prototype.find.call(mediaElements, media => !media.paused) || mediaElements[0];
		window.AudioController ||= class AudioController {
			ctx = new AudioContext();
			gainNode = new GainNode(this.ctx);
			source = null;
			constructor({ gain } = {}) {
				gain && (this.gainNode.gain.value = gain);
				this.gainNode.connect(this.ctx.destination);
				Object.defineProperty(this, 'gain', { enumerable: true, value: this.gainNode.gain });
			}
			attach(media) {
				this.source = this.ctx.createMediaStreamSource(media.captureStream());  // this.ctx.createMediaElementSource(media);
				this.source.connect(this.gainNode);
				return this.source;
			}
			detach() {
				this.source.disconnect(this.gainNode);
				this.source = null;
				return true;
			}
		}
		if (!media || media.audioController instanceof AudioController) return;
		media.audioController = new AudioController();
		media.audioController.attach(media);
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if (sender.id !== chrome.runtime.id) return;
			switch (request.op) {
			case 3:
				if (!(media.audioController instanceof AudioController)) {
					media.audioController = new AudioController();
					media.audioController.attach(media);
				}
				media.audioController.gain.value = request.data.value / 100;
				sendResponse(Math.floor(media.audioController.gain.value * 100));
				break;
			case 4:
				// media.audioController.gain.value = 1;
				media && media.audioController && (media.audioController.detach(),
				media.audioController = null);
				sendResponse(true);
			}
		});
	}
});

document.documentElement.addEventListener('pointerdown', function (event) {
	this.style.setProperty('--offsetX', event.offsetX);
	this.style.setProperty('--offsetY', event.offsetY);
});

function setState(enabled) {
	state.classList[enabled ? 'add' : 'remove']('enabled');
	return enabled;
}