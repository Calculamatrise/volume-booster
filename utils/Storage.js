import DynamicMap from "./DynamicMap.js";

chrome.storage.proxy ??= {};
for (const scope of Array('local', 'session').filter(scope => typeof chrome.storage[scope] == 'object')) {
	chrome.storage.proxy[scope] ??= new Proxy((() => {
		const instance = new DynamicMap();
		chrome.storage[scope].get(data => Object.assign(instance, data));
		chrome.storage[scope].onChanged.addListener(data => {
			Object.assign(instance, Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.newValue])));
		});
		return instance;
	})(), {
		get(target, property) {
			if (typeof target[property] == 'object' && target[property] !== null && target[property].constructor === Object) {
				Reflect.set(target, property, new Proxy(new DynamicMap(target[property]), this));
			}

			return Reflect.get(...arguments);
		},
		set() {
			Reflect.set(...arguments);
			chrome.storage[scope].set(chrome.storage.proxy[scope]);
			return true;
		},
		deleteProperty() {
			Reflect.deleteProperty(...arguments);
			chrome.storage[scope].set(chrome.storage.proxy[scope]);
			return true;
		}
	});
}