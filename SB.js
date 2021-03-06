SB = {
    /**
     * Callback function when an option is updated
     * 
     * @type {CallableFunction}
     */
    configListeners: []
};

// Function setup

// Allows a map to be conveted into json form
// Currently used for local storage
Map.prototype.toJSON = function() {
    return Array.from(this.entries());
};

// Proxy Map changes to Map in SB.localConfig
// Saves the changes to chrome.storage in json form
class MapIO {
    constructor(id) {
	// The name of the item in the array
        this.id = id;
	// A local copy of the map (SB.config.mapname.map)
        this.map = SB.localConfig[this.id];
    }
    set(key, value) {
	// Proxy to map
        this.map.set(key, value);
        // Store updated map locally
        chrome.storage.sync.set({
            [this.id]: encodeStoredItem(this.map)
        });
        return this.map;
    }

    get(key) {
        return this.map.get(key);
    }
	
    has(key) {
        return this.map.has(key);
    }
	
    size() {
        return this.map.size;
    }
	
    delete(key) {
	// Proxy to map
        this.map.delete(key);
	// Store updated map locally
	chrome.storage.sync.set({
            [this.id]: encodeStoredItem(this.map)
        });
    }

    clear() {
        this.map.clear();
	chrome.storage.sync.set({
            [this.id]: encodeStoredItem(this.map)
        });
    }
}

/**
 * A Map cannot be stored in the chrome storage. 
 * This data will be encoded into an array instead as specified by the toJSON function.
 * 
 * @param {*} data 
 */
function encodeStoredItem(data) {
    // if data is Map convert to json for storing
    if(!(data instanceof Map)) return data;
    return JSON.stringify(data);
}

/**
 * A Map cannot be stored in the chrome storage. 
 * This data will be decoded from the array it is stored in
 * 
 * @param {*} data 
 */
function decodeStoredItem(data) {
    if(typeof data !== "string") return data;
    
    try {
        let str = JSON.parse(data);
        
        if(!Array.isArray(str)) return data;
        return new Map(str);
    } catch(e) {

        // If all else fails, return the data
        return data;
    }
}

function configProxy() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        for (const key in changes) {
            SB.localConfig[key] = decodeStoredItem(changes[key].newValue);
        }

        for (const callback of SB.configListeners) {
            callback(changes);
        }
    });
	
    var handler = {
        set(obj, prop, value) {
            SB.localConfig[prop] = value;

            chrome.storage.sync.set({
                [prop]: encodeStoredItem(value)
            });
        },

        get(obj, prop) {
            let data = SB.localConfig[prop];
            if(data instanceof Map) data = new MapIO(prop);

            return obj[prop] || data;
        },
	
        deleteProperty(obj, prop) {
	    chrome.storage.sync.remove(prop);
        }

    };

    return new Proxy({handler}, handler);
}

function fetchConfig() { 
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(null, function(items) {
            SB.localConfig = items;  // Data is ready
            resolve();
        });
    });
}

function migrateOldFormats() { // Convert sponsorTimes format
    for (const key in SB.localConfig) {
        if (key.startsWith("sponsorTimes") && key !== "sponsorTimes" && key !== "sponsorTimesContributed") {
            SB.config.sponsorTimes.set(key.substr(12), SB.config[key]);
            delete SB.config[key];
        }
    }
}

async function setupConfig() {
    await fetchConfig();
    addDefaults();
    convertJSON();
    SB.config = configProxy();
    migrateOldFormats();
}

SB.defaults = {
    "sponsorTimes": new Map(),
    "startSponsorKeybind": ";",
    "submitKeybind": "'",
    "minutesSaved": 0,
    "skipCount": 0,
    "sponsorTimesContributed": 0,
    "disableSkipping": false,
    "disableAutoSkip": false,
    "trackViewCount": true,
    "dontShowNotice": false,
    "hideVideoPlayerControls": false,
    "hideInfoButtonPlayerControls": false,
    "hideDeleteButtonPlayerControls": false,
    "hideDiscordLaunches": 0,
    "hideDiscordLink": false,
    "invidiousInstances": ["invidio.us", "invidiou.sh", "invidious.snopyta.org"],
    "invidiousUpdateInfoShowCount": 0,
    "autoUpvote": true
}

// Reset config
function resetConfig() {
    SB.config = SB.defaults;
};

function convertJSON() {
    Object.keys(SB.defaults).forEach(key => {
        SB.localConfig[key] = decodeStoredItem(SB.localConfig[key], key);
    });
}

// Add defaults
function addDefaults() {
    for (const key in SB.defaults) {
        if(!SB.localConfig.hasOwnProperty(key)) {
	    SB.localConfig[key] = SB.defaults[key];
        }
    }
};

// Sync config
setupConfig();
