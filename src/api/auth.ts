/**
 * A complete, human-readable authentication system for generating tokens from cookies and window properties
 *
 * This code generates authentication tokens for secure API requests by:
 * 1. Retrieving authentication tokens from window properties or cookies
 * 2. Creating secure hashes using SHA-1
 * 3. Combining them into a standardized format
 *
 * @file auth.ts
 * @author Cleaned and documented version
 */
(function () {
    interface CookieOptions {
        sameSite?: string;
        secure?: boolean;
        domain?: string;
        path?: string;
        expirySeconds?: number;
    }

    interface AuthParam {
        key: string;
        value: string;
    }

    type AdditionalParams = AuthParam[] | null | any;

    /**
     * Cookie handler class for getting, setting and managing cookies
     */
    class CookieHandler {
        private document: Document;

        constructor() {
            this.document = document || ({ cookie: "" } as Document);
        }

        /**
         * Checks if cookies are enabled in the browser
         * @returns {boolean} True if cookies are enabled
         */
        isEnabled(): boolean {
            if (!window.navigator.cookieEnabled) {
                return false;
            }

            if (!this.isEmpty()) {
                return true;
            }

            this.set("TESTCOOKIESENABLED", "1", { expirySeconds: 60 });

            if (this.get("TESTCOOKIESENABLED") !== "1") {
                return false;
            }

            this.remove("TESTCOOKIESENABLED");
            return true;
        }

        /**
         * Sets a cookie with the given name, value and options
         * @param {string} name - Cookie name
         * @param {string} value - Cookie value
         * @param {Object} options - Cookie options
         * @param {string} [options.sameSite] - SameSite attribute
         * @param {boolean} [options.secure] - Secure attribute
         * @param {string} [options.domain] - Domain attribute
         * @param {string} [options.path] - Path attribute
         * @param {number} [options.expirySeconds] - Seconds until expiry
         */
        set(name: string, value: string, options: CookieOptions = {}): void {
            const secure = options.secure || false;
            const domain = options.domain ? `;domain=${options.domain}` : "";
            const path = options.path ? `;path=${options.path}` : "";
            const expirySeconds = options.expirySeconds;

            // Validate cookie name and value
            if (/[;=\s]/.test(name)) {
                throw new Error(`Invalid cookie name: ${name}`);
            }

            if (/[;\r\n]/.test(value)) {
                throw new Error(`Invalid cookie value: ${value}`);
            }

            // Set expiry
            let expires = "";
            if (expirySeconds !== undefined) {
                if (expirySeconds < 0) {
                    expires = "";
                } else if (expirySeconds === 0) {
                    expires = `;expires=${new Date(1970, 1, 1).toUTCString()}`;
                } else {
                    expires = `;expires=${new Date(Date.now() + expirySeconds * 1000).toUTCString()}`;
                }
            }

            // Set secure flag
            const secureFlag = secure ? ";secure" : "";

            // Set sameSite
            const sameSite = options.sameSite != null ? `;samesite=${options.sameSite}` : "";

            // Set the cookie
            this.document.cookie = `${name}=${value}${domain}${path}${expires}${secureFlag}${sameSite}`;
        }

        /**
         * Gets a cookie by name
         * @param {string} name - Cookie name
         * @param {string} [defaultValue] - Default value if cookie not found
         * @returns {string} Cookie value or defaultValue
         */
        get(name: string, defaultValue?: string): string | undefined {
            const prefix = `${name}=`;
            const cookies = (this.document.cookie || "").split(";");

            for (let i = 0; i < cookies.length; i++) {
                let cookie = cookies[i].trim();

                if (cookie.indexOf(prefix) === 0) {
                    return cookie.substring(prefix.length);
                }

                if (cookie === name) {
                    return "";
                }
            }

            return defaultValue;
        }

        /**
         * Removes a cookie
         * @param {string} name - Cookie name
         * @param {string} [path] - Cookie path
         * @param {string} [domain] - Cookie domain
         * @returns {boolean} True if cookie was removed
         */
        remove(name: string, path?: string, domain?: string): boolean {
            const existed = this.get(name) !== undefined;

            this.set(name, "", {
                expirySeconds: 0,
                path: path,
                domain: domain,
            });

            return existed;
        }

        /**
         * Checks if cookies are empty
         * @returns {boolean} True if no cookies exist
         */
        isEmpty(): boolean {
            return !this.document.cookie;
        }

        /**
         * Gets all cookie names
         * @returns {Array<string>} Array of cookie names
         */
        getKeys(): string[] {
            return this.parseCookies().keys;
        }

        /**
         * Gets all cookie values
         * @returns {Array<string>} Array of cookie values
         */
        getValues(): string[] {
            return this.parseCookies().values;
        }

        /**
         * Gets cookie count
         * @returns {number} Number of cookies
         */
        getCount(): number {
            return this.document.cookie ? (this.document.cookie || "").split(";").length : 0;
        }

        /**
         * Clears all cookies
         */
        clear(): void {
            const keys = this.parseCookies().keys;

            for (let i = keys.length - 1; i >= 0; i--) {
                this.remove(keys[i]);
            }
        }

        /**
         * Parses all cookies into keys and values
         * @returns {Object} Object with keys and values arrays
         * @private
         */
        private parseCookies(): { keys: string[]; values: string[] } {
            const cookies = (this.document.cookie || "").split(";");
            const keys: string[] = [];
            const values: string[] = [];

            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                const separatorIndex = cookie.indexOf("=");

                if (separatorIndex === -1) {
                    keys.push("");
                    values.push(cookie);
                } else {
                    keys.push(cookie.substring(0, separatorIndex));
                    values.push(cookie.substring(separatorIndex + 1));
                }
            }

            return { keys, values };
        }
    }

    /**
     * Normalizes a URL to a consistent format
     * @param {string} url - URL to normalize
     * @returns {string} Normalized URL
     */
    function normalizeUrl(url: string): string {
        if (!url) return "";

        // Handle special about: URLs
        if (/^about:(?:blank|srcdoc)$/.test(url)) {
            return window.origin || "";
        }

        // Handle blob: URLs
        if (url.indexOf("blob:") === 0) {
            url = url.substring(5);
        }

        // Remove fragments and query parameters
        url = url.split("#")[0].split("?")[0];
        url = url.toLowerCase();

        // Handle protocol-relative URLs
        if (url.indexOf("//") === 0) {
            url = window.location.protocol + url;
        }

        // Handle relative URLs
        if (!/^[\w\-]*:\/\//.test(url)) {
            url = window.location.href;
        }

        // Extract host and protocol
        const protocolSeparatorIndex = url.indexOf("://");
        const protocol = url.substring(0, protocolSeparatorIndex);

        if (!protocol) {
            throw new Error(`Invalid URL: ${url}`);
        }

        // Validate protocol
        const validProtocols = [
            "http",
            "https",
            "chrome-extension",
            "moz-extension",
            "file",
            "android-app",
            "chrome-search",
            "chrome-untrusted",
            "chrome",
            "app",
            "devtools",
        ];

        if (!validProtocols.includes(protocol)) {
            throw new Error(`Invalid protocol: ${protocol}`);
        }

        // Extract and process host and port
        let host = url.substring(protocolSeparatorIndex + 3);
        const pathSeparatorIndex = host.indexOf("/");

        if (pathSeparatorIndex !== -1) {
            host = host.substring(0, pathSeparatorIndex);
        }

        let portSuffix = "";
        const portSeparatorIndex = host.indexOf(":");

        if (portSeparatorIndex !== -1) {
            const port = host.substring(portSeparatorIndex + 1);
            host = host.substring(0, portSeparatorIndex);

            // Include non-standard ports in the normalized URL
            if ((protocol === "http" && port !== "80") || (protocol === "https" && port !== "443")) {
                portSuffix = ":" + port;
            }
        }

        return `${protocol}://${host}${portSuffix}`;
    }

    /**
     * Calculates a SHA-1 hash from a string
     * @param {string} input - String to hash
     * @returns {string} Lowercase hex SHA-1 hash
     */
    function calculateHash(input: string): string {
        const hashGenerator = createHashGenerator();
        hashGenerator.update(input);
        return hashGenerator.getHash().toLowerCase();
    }

    /**
     * Creates parameters for authentication
     * @param {string} url - Normalized URL
     * @param {string} token - Authentication token
     * @param {Array|Object|null} additionalParams - Additional parameters
     * @returns {string} Authentication parameter string
     */
    function createAuthParams(url: string, token: string, additionalParams: AdditionalParams): string {
        // In the original, this was an unused parameter that might have been
        // intended for additional data but appears to always be empty
        const additionalData: string[] = [];

        // Simple case: additionalParams is not an array (or is null/undefined)
        if (!Array.isArray(additionalParams)) {
            // Join token and URL
            const baseParams = [token, url];

            // Add any additional data (though in the original code, this array was empty)
            additionalData.forEach((item) => {
                baseParams.push(item);
            });

            // Just hash the joined string
            return calculateHash(baseParams.join(" "));
        }
        // Complex case with additionalParams as array of objects with key/value pairs
        else {
            const keys: string[] = [];
            const values: string[] = [];

            // Extract keys and values from additionalParams items
            additionalParams.forEach((param) => {
                keys.push(param.key);
                values.push(param.value);
            });

            // Get current timestamp in seconds
            const timestamp = Math.floor(Date.now() / 1000);

            // Create base parameters array with timestamp included
            const baseParams = values.length === 0 ? [timestamp, token, url] : [values.join(":"), timestamp, token, url];

            // Add any additional data (though in the original code, this array was empty)
            additionalData.forEach((item) => {
                baseParams.push(item);
            });

            // Calculate hash from all parameters
            const hash = calculateHash(baseParams.join(" "));

            // Format final authentication parameter with timestamp_hash_keys format
            const result = [timestamp, hash];

            if (keys.length > 0) {
                result.push(keys.join(""));
            }

            return result.join("_");
        }
    }

    /**
     * Creates an authentication hash
     * @param {string} token - Authentication token
     * @param {string} hashName - Hash name
     * @param {Object|Array|null} additionalParams - Additional parameters
     * @returns {string|null} Authentication hash or null
     */
    function createAuthHash(token: string, hashName: string, additionalParams: AdditionalParams): string | null {
        const currentUrl = String(window.location.href);

        if (currentUrl && token && hashName) {
            return [hashName, createAuthParams(normalizeUrl(currentUrl), token, additionalParams || null)].join(" ");
        }

        return null;
    }

    /**
     * Gets a token from window or cookie and creates an auth hash
     * @param {string} windowProperty - Window property name
     * @param {string} cookieName - Cookie name
     * @param {string} hashName - Hash name
     * @param {Object|Array|null} additionalParams - Additional parameters
     * @returns {string|null} Authentication hash or null
     */
    function getTokenAndCreateHash(
        windowProperty: string,
        cookieName: string,
        hashName: string,
        additionalParams: AdditionalParams
    ): string | null {
        // Try to get token from window property
        let token = (window as any)[windowProperty];

        // If not found, try cookies
        if (!token && typeof document !== "undefined") {
            const cookieHandler = new CookieHandler();
            token = cookieHandler.get(cookieName);
        }

        // Create hash if token exists
        return token ? createAuthHash(token, hashName, additionalParams) : null;
    }

    /**
     * Gets authentication tokens from various sources
     * @param {Object|Array|null} authParams - Authentication parameters
     * @returns {string|null} Space-separated authentication tokens or null
     */
    function getAuthTokens(authParams: AdditionalParams): string | null {
        const baseUrl = location.origin;
        const authTokens: string[] = [];

        // Create cookie handler once
        const cookieHandler = new CookieHandler();

        // Check if any direct window properties contain auth tokens
        let hasToken =
            (window as any).__SAPISID ||
            (window as any).__APISID ||
            (window as any).__3PSAPISID ||
            (window as any).__1PSAPISID ||
            (window as any).__OVERRIDE_SID;

        // If no window properties, check cookies
        if (!hasToken && typeof document !== "undefined") {
            hasToken =
                cookieHandler.get("SAPISID") ||
                cookieHandler.get("APISID") ||
                cookieHandler.get("__Secure-3PAPISID") ||
                cookieHandler.get("__Secure-1PAPISID");
        }

        if (hasToken) {
            // Determine if using secure protocol
            const isSecureProtocol =
                baseUrl.indexOf("https:") === 0 ||
                baseUrl.indexOf("chrome-extension:") === 0 ||
                baseUrl.indexOf("chrome-untrusted://new-tab-page") === 0 ||
                baseUrl.indexOf("moz-extension:") === 0;

            // Get the appropriate token based on protocol
            let token = isSecureProtocol ? (window as any).__SAPISID : (window as any).__APISID;

            // If token not in window, try cookies
            if (!token && typeof document !== "undefined") {
                const cookieName = isSecureProtocol ? "SAPISID" : "APISID";
                token = cookieHandler.get(cookieName) || cookieHandler.get("__Secure-3PAPISID");
            }

            // Generate and add hash if token exists
            if (token) {
                const hashName = isSecureProtocol ? "SAPISIDHASH" : "APISIDHASH";
                const hash = createAuthHash(token, hashName, authParams);
                if (hash) {
                    authTokens.push(hash);
                }
            }

            // Add additional secure tokens if using secure protocol
            if (isSecureProtocol) {
                // Get SAPISID1PHASH
                const secureToken1 = getTokenAndCreateHash("__1PSAPISID", "__Secure-1PAPISID", "SAPISID1PHASH", authParams);
                if (secureToken1) {
                    authTokens.push(secureToken1);
                }

                // Get SAPISID3PHASH
                const secureToken3 = getTokenAndCreateHash("__3PSAPISID", "__Secure-3PAPISID", "SAPISID3PHASH", authParams);
                if (secureToken3) {
                    authTokens.push(secureToken3);
                }
            }
        }

        return authTokens.length === 0 ? null : authTokens.join(" ");
    }

    interface HashGenerator {
        reset: () => void;
        update: (data: string | number[], dataLength?: number) => void;
        digest: () => number[];
        getHash: () => string;
    }

    /**
     * Creates a SHA-1 hash generator
     * @returns {Object} SHA-1 hash generator with update and getHash methods
     */
    function createHashGenerator(): HashGenerator {
        // SHA-1 implementation based on the Zla function
        // Initialize hash values (h0, h1, h2, h3, h4)
        const hashValues = [
            1732584193, // 0x67452301
            4023233417, // 0xEFCDAB89
            2562383102, // 0x98BADCFE
            271733878, // 0x10325476
            3285377520, // 0xC3D2E1F0
        ];

        // Message buffer and processing arrays
        const messageBuffer: number[] = [];
        const wordArray: number[] = [];

        // Create padding array with first byte as 0x80 (128) and rest as 0
        const padding = [128];
        for (let i = 1; i < 64; ++i) {
            padding[i] = 0;
        }

        // Track buffer position and total message length
        let bufferPos = 0;
        let totalLength = 0;

        /**
         * Resets the hash generator to initial state
         */
        function reset(): void {
            hashValues[0] = 1732584193;
            hashValues[1] = 4023233417;
            hashValues[2] = 2562383102;
            hashValues[3] = 271733878;
            hashValues[4] = 3285377520;
            bufferPos = totalLength = 0;
        }

        /**
         * Processes a 64-byte block of data
         * @param {Array<number>} block - 64-byte block to process
         */
        function processBlock(block: number[]): void {
            // Copy block into the word array as 32-bit integers
            for (let i = 0; i < 64; i += 4) {
                wordArray[i / 4] = (block[i] << 24) | (block[i + 1] << 16) | (block[i + 2] << 8) | block[i + 3];
            }

            // Extend the 16 32-bit words to 80 32-bit words
            for (let i = 16; i < 80; i++) {
                const w = wordArray[i - 3] ^ wordArray[i - 8] ^ wordArray[i - 14] ^ wordArray[i - 16];
                wordArray[i] = ((w << 1) | (w >>> 31)) & 0xffffffff; // Circular left shift by 1
            }

            // Initialize working variables
            let a = hashValues[0];
            let b = hashValues[1];
            let c = hashValues[2];
            let d = hashValues[3];
            let e = hashValues[4];

            // Main loop
            for (let i = 0; i < 80; i++) {
                let f, k;

                if (i < 20) {
                    f = (b & c) | (~b & d); // Alternative: d ^ (b & (c ^ d))
                    k = 1518500249; // 0x5A827999
                } else if (i < 40) {
                    f = b ^ c ^ d;
                    k = 1859775393; // 0x6ED9EBA1
                } else if (i < 60) {
                    f = (b & c) | (d & (b | c)); // Alternative: (b & c) | (b & d) | (c & d)
                    k = 2400959708; // 0x8F1BBCDC
                } else {
                    f = b ^ c ^ d;
                    k = 3395469782; // 0xCA62C1D6
                }

                // Calculate new working variables
                const temp = ((((a << 5) | (a >>> 27)) & 0xffffffff) + f + e + k + wordArray[i]) & 0xffffffff;
                e = d;
                d = c;
                c = ((b << 30) | (b >>> 2)) & 0xffffffff;
                b = a;
                a = temp;
            }

            // Update hash values
            hashValues[0] = (hashValues[0] + a) & 0xffffffff;
            hashValues[1] = (hashValues[1] + b) & 0xffffffff;
            hashValues[2] = (hashValues[2] + c) & 0xffffffff;
            hashValues[3] = (hashValues[3] + d) & 0xffffffff;
            hashValues[4] = (hashValues[4] + e) & 0xffffffff;
        }

        /**
         * Updates the hash with new data
         * @param {string|Array<number>} data - Data to add to hash
         * @param {number} [dataLength] - Length of data (optional)
         */
        function update(data: string | number[], dataLength?: number): void {
            // Convert string to array of bytes
            if (typeof data === "string") {
                data = unescape(encodeURIComponent(data));
                const bytes: number[] = [];
                for (let i = 0, len = data.length; i < len; ++i) {
                    bytes.push(data.charCodeAt(i));
                }
                data = bytes;
            }

            const length = dataLength || data.length;

            let dataPos = 0;

            // Process complete blocks if buffer is empty
            if (bufferPos === 0) {
                while (dataPos + 64 < length) {
                    processBlock(data.slice(dataPos, dataPos + 64));
                    dataPos += 64;
                    totalLength += 64;
                }
            }

            // Fill the buffer with remaining data
            while (dataPos < length) {
                messageBuffer[bufferPos++] = data[dataPos++];
                totalLength++;

                // Process the block when buffer is full
                if (bufferPos === 64) {
                    processBlock(messageBuffer);
                    bufferPos = 0;

                    // Process complete blocks from remaining data
                    while (dataPos + 64 < length) {
                        processBlock(data.slice(dataPos, dataPos + 64));
                        dataPos += 64;
                        totalLength += 64;
                    }
                }
            }
        }

        /**
         * Finalizes the hash calculation and returns the digest
         * @returns {Array<number>} SHA-1 digest as byte array
         */
        function digest(): number[] {
            const result: number[] = [];
            let bitLength = totalLength * 8;

            // Append padding
            if (bufferPos < 56) {
                update(padding, 56 - bufferPos);
            } else {
                update(padding, 64 - (bufferPos - 56));
            }

            // Append length (64 bits)
            for (let i = 63; i >= 56; i--) {
                messageBuffer[i] = bitLength & 0xff;
                bitLength >>>= 8;
            }

            processBlock(messageBuffer);

            // Convert hash values to byte array
            for (let i = 0, j = 0; i < 5; i++) {
                for (let k = 24; k >= 0; k -= 8) {
                    result[j++] = (hashValues[i] >> k) & 0xff;
                }
            }

            return result;
        }

        /**
         * Returns the hash as a hex string
         * @returns {string} SHA-1 digest as hexadecimal string
         */
        function getHashHex(): string {
            const bytes = digest();
            let hexString = "";

            for (let i = 0; i < bytes.length; i++) {
                hexString +=
                    "0123456789ABCDEF".charAt(Math.floor(bytes[i] / 16)) + "0123456789ABCDEF".charAt(bytes[i] % 16);
            }

            return hexString;
        }

        // Initialize
        reset();

        // Return the public interface
        return {
            reset: reset,
            update: update,
            digest: digest,
            getHash: getHashHex,
        };
    }

    (window as any).getAuthTokens = getAuthTokens;
    console.debug("auth.ts loaded");
})();