// import { getAuthTokens } from "./auth";
// The import is replaced with direct function reference that's globally available
(function () {
    // Cache for API keys and tracking successful key
    let cachedUrl: string | null = null;
    let cachedApiKeys: string[] | null = null;
    let lastSuccessfulKey: string | null = null;

    function sendMakerSuiteRequest(path: string, method: string, data: any): Promise<string> {
        const url = `${findUrl()}/$rpc/google.internal.alkali.applications.makersuite.v1.MakerSuiteService/${path}`;
        const async = true;

        data = JSON.stringify(data);

        // Check if the required functions are available
        if (typeof (window as any).aiStudioExt.getAuthTokens !== "function") throw new Error("getAuthTokens is not a function");
        //if (typeof (window as any).aiStudioExt.findApiKeys !== "function") throw new Error("findApiKeys is not a function");
        // Get the auth tokens and API keys
        const authTokens = (window as any).aiStudioExt.getAuthTokens([]);
        if (!authTokens) throw new Error("No auth tokens found");

        // Use cached API keys if available, otherwise fetch them
        if (!cachedApiKeys) {
            cachedApiKeys = findApiKeys();
            console.log(`Loaded ${cachedApiKeys.length} API keys`);
        }

        if (cachedApiKeys.length === 0) throw new Error("No API keys found");

        // If we have a successful key, try it first
        let keysToTry = [...cachedApiKeys];
        if (lastSuccessfulKey && cachedApiKeys.includes(lastSuccessfulKey)) {
            // Move successful key to front of array
            keysToTry = [lastSuccessfulKey, ...cachedApiKeys.filter((key) => key !== lastSuccessfulKey)];
        }

        return new Promise((resolve, reject) => {
            // Try each API key until success or all keys are exhausted
            attemptRequestWithKeys(0, keysToTry, resolve, reject);
        });

        /**
         * Attempts to make the API request with a specific API key index.
         * If the request fails, it retries with the next available key.
         *
         * @param {number} keyIndex - The index of the API key to use
         * @param {string[]} keys - The array of API keys to try
         */
        function attemptRequestWithKeys(keyIndex: number, keys: string[], onSuccess: (responseText: string) => void, onError: (status: number | string, statusText: string | null) => void): void {
            // If we've tried all keys, report error
            if (keyIndex >= keys.length) {
                if (onError) {
                    onError("All API keys failed", "Unable to create prompt after trying all available API keys");
                }
                return;
            }

            const currentKey = keys[keyIndex];
            var xhr = new XMLHttpRequest();
            xhr.open(method, url, async);

            // Set headers
            xhr.setRequestHeader("authorization", authTokens);
            xhr.setRequestHeader("content-type", "application/json+protobuf");
            xhr.setRequestHeader("x-goog-api-key", currentKey);
            xhr.setRequestHeader("x-user-agent", "grpc-web-javascript/0.1");

            // Handle response
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.debug("Success:", xhr.responseText);
                    // Store the successful key
                    lastSuccessfulKey = currentKey;
                    if (onSuccess) {
                        onSuccess(xhr.responseText);
                    }
                } else {
                    console.warn(`Error with API key ${keyIndex + 1}/${keys.length}:`, xhr.status, xhr.statusText);

                    // If this was our last successful key that failed, refresh keys
                    if (currentKey === lastSuccessfulKey) {
                        console.warn("Previously successful key failed, refreshing API keys...");
                        cachedApiKeys = findApiKeys([currentKey]); // Ignore the failed key
                        lastSuccessfulKey = null;

                        // If we have new keys, try those
                        if (cachedApiKeys.length > 0) {
                            attemptRequestWithKeys(0, cachedApiKeys, onSuccess, onError);
                            return;
                        }
                    }

                    // Try the next key
                    attemptRequestWithKeys(keyIndex + 1, keys, onSuccess, onError);
                }
            };

            xhr.onerror = function () {
                console.warn(`Request failed with API key ${keyIndex + 1}/${keys.length}`);

                // If this was our last successful key that failed, refresh keys
                if (currentKey === lastSuccessfulKey) {
                    console.warn("Previously successful key failed, refreshing API keys...");
                    cachedApiKeys = findApiKeys([currentKey]); // Ignore the failed key
                    lastSuccessfulKey = null;

                    // If we have new keys, try those
                    if (cachedApiKeys.length > 0) {
                        attemptRequestWithKeys(0, cachedApiKeys, onSuccess, onError);
                        return;
                    }
                }

                // Try the next key
                attemptRequestWithKeys(keyIndex + 1, keys, onSuccess, onError);
            };

            // Send the request
            xhr.withCredentials = true; //Include cookies, use this when you need to authenticate
            xhr.send(data);
        }
    }
    /**
     * Creates a prompt using the MakerSuite API.
     *
     * @param {string} promptData - The prompt data in the format expected by the API.
     * @param {function} onSuccess - Callback function to execute on successful API call.  Receives the response text as an argument.
     * @param {function} onError - Callback function to execute on API error. Receives the error status and status text as arguments.
     */
    function createMakerSuitePrompt(
        promptName: string,
        promptData: any
    ): Promise<string> {
        return sendMakerSuiteRequest("CreatePrompt", "POST", convertPromptData(promptName, promptData));
    }

    /**
     * Finds all API keys in the script tags of the current document.
     *
     * @param {string[]} ignore - Array of API keys to ignore (e.g., failed keys)
     * @returns {string[]} An array of API keys found in the script tags.
     */
    function findApiKeys(ignore: string[] = []): string[] {
        const scripts = document.querySelectorAll("script");
        const apiKeys = new Set<string>();
        for (const script of scripts as unknown as HTMLScriptElement[]) {
            const src = script.innerHTML;
            const match = src.match(/[`'"](AIzaSy([^\s`'"]*))[`'"]/g) ?? [];
            match.forEach((m) => {
                const key = m.replace(/[`'"]/g, "");
                if (!ignore.includes(key)) {
                    apiKeys.add(key);
                }
            });
        }
        return Array.from(apiKeys).reverse(); // Seems like the last key is the one that works usually
    }

    /**
     * Finds the URL of the MakerSuite API in the script tags of the current document.
     *
     * @returns {string} The URL of the MakerSuite API.
     */
    function findUrl(): string {
        if (cachedUrl) return cachedUrl;
        const scripts = document.querySelectorAll("script");
        for (const script of scripts as unknown as HTMLScriptElement[]) {
            const src = script.innerHTML;
            const match = src.match(/[`'"](https\:\/\/alkalimakersuite[^`'"]*\.google\.com)[`'"]/g);
            if (match) {
                cachedUrl = match[0].replace(/[`'"]/g, "");
                return cachedUrl;
            }
        }
        throw new Error("No API URL found");
    }

    /**
     * Converts a message to a prompt for the MakerSuite API.
     * @param {string} role - The role of the message.
     * @param {Part} message - The message to convert.
     * @returns {any} The converted message.
     */
    function convertMessage(role: string, message: Part): any[] {
        // Convert role:
        switch (role) {
            case "user":
                role = "user";
                break;
            case "model":
            case "assistant":
                role = "model";
                break;
            default:
                role = "user";
        }

        return [message.text, null, null, null, null, null, null, null, role];
    }

    /**
     * Converts a response schema to a number.
     * @param {ResponseSchema} responseSchema - The response schema to convert.
     * @param {string} name - The name of the schema.
     * @returns {any} The converted schema.
     */
    function convertResponseSchema(responseSchema: any): any {
        const type = responseSchema.type.toLocaleLowerCase();
        const schema = [
            SCHEMA_TYPE_TO_NUMBER[type as SchemaType],
            null,
            responseSchema.description ?? null,
            responseSchema.nullable ?? null,
            type === SchemaType.STRING && responseSchema.enum ? responseSchema.enum : null,
            type === SchemaType.ARRAY ? convertResponseSchema(responseSchema.items) : null,
            type === SchemaType.OBJECT
                ? Object.entries(responseSchema.properties).map(([key, value]) => [key, convertResponseSchema(value)])
                : null,
            responseSchema.type === SchemaType.OBJECT && responseSchema.required ? responseSchema.required : null,
        ];
        // Remove null values from the end of the array
        for (let i = schema.length - 1; i >= 0; i--) {
            if (schema[i] != null) {
                schema.splice(i + 1, schema.length - i - 1);
                break;
            }
        }
        return schema;
    }

    const UNKNOWN_PAD = [
        // Unsure what this is
        [null, null, 7, 1],
        [null, null, 8, 2],
        [null, null, 9, 3],
        [null, null, 10, 4],
        [null, null, 11, 5],
    ];

    /**
     * Converts a generation request to a prompt for the MakerSuite API.
     * @param {string} promptName - The name of the prompt.
     * @param {GenerateContentRequest} generationRequest - The generation request to convert.
     * @returns {any} The converted prompt.
     */
    function convertPromptAPI(promptName: string, generationRequest: GenerateContentRequest): any {
        const config = [
            generationRequest.generationConfig?.temperature ?? null, //1
            null, // Stop sequences
            generationRequest.model ? `models/${generationRequest.model}` : null, //"models/gemini-2.0-flash",
            null,
            generationRequest.generationConfig?.topP ?? null, //0.95,
            generationRequest.generationConfig?.topK ?? null, //40,
            generationRequest.generationConfig?.maxOutputTokens ?? null, //8192,
            UNKNOWN_PAD,
            generationRequest.generationConfig?.responseMimeType ??
                (generationRequest.generationConfig?.responseSchema ? "application/json" : "text/plain"),
            0,
            generationRequest.generationConfig?.responseSchema
                ? convertResponseSchema(generationRequest.generationConfig.responseSchema)
                : null,
            null,
            null,
            1,
            0,
            null,
            null,
            0,
            0,
        ];

        const title = [
            promptName, // Title
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            [],
        ];

        const outside = [
            [
                null, // Prompt id
                null,
                null,
                config,
                title,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                generationRequest.systemInstruction ? [generationRequest.systemInstruction] : [],
                [
                    generationRequest.contents
                        .map((content) => content.parts.map((part) => convertMessage(content.role, part)))
                        .flat(),
                    [["", null, null, null, null, null, null, null, "user"]], // Seems like the user input field
                ],
            ],
        ];
        return outside;
    }

    /**
     * Converts a generation request to a prompt for the AI Studio API.
     * @param {string} promptName - The name of the prompt.
     * @param {AIStudioFile} generationRequest - The generation request to convert.
     * @returns {any} The converted prompt.
     */
    function convertPromptStudio(promptName: string, generationRequest: AIStudioFile): any {
        const config = [
            generationRequest.runSettings?.temperature ?? null, //1
            null, // Stop sequences
            generationRequest.runSettings?.model ?? null, //"models/gemini-2.0-flash",
            null,
            generationRequest.runSettings?.topP ?? null, //0.95,
            generationRequest.runSettings?.topK ?? null, //40,
            generationRequest.runSettings?.maxOutputTokens ?? null, //8192,
            UNKNOWN_PAD,
            generationRequest.runSettings?.responseMimeType ??
                (generationRequest.runSettings?.responseSchema ? "application/json" : "text/plain"),
            0,
            generationRequest.runSettings?.responseSchema
                ? convertResponseSchema(generationRequest.runSettings.responseSchema)
                : null,
            null,
            null,
            1,
            0,
            null,
            null,
            0,
            0,
        ];

        const title = [
            promptName, // Title
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            [],
        ];

        const outside = [
            [
                null, // Prompt id
                null,
                null,
                config,
                title,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                generationRequest.systemInstruction ? [generationRequest.systemInstruction] : [],
                [
                    generationRequest.chunkedPrompt?.chunks.map((content) =>
                        convertMessage(content.role, { text: content.text })
                    ),
                    [["", null, null, null, null, null, null, null, "user"]], // Seems like the user input field
                ],
            ],
        ];
        return outside;
    }

    /**
     * Converts a generation request to a prompt for the MakerSuite API or AI Studio API.
     * @param {string} promptName - The name of the prompt.
     * @param {GenerateContentRequest | AIStudioFile} generationRequest - The generation request to convert.
     * @returns {any} The converted prompt.
     */
    function convertPromptData(promptName: string, generationRequest: GenerateContentRequest | AIStudioFile): any {
        if ("generationConfig" in generationRequest) {
            return convertPromptAPI(promptName, generationRequest);
        } else {
            return convertPromptStudio(promptName, generationRequest as AIStudioFile);
        }
    }

    interface SafetySetting {
        category: HarmCategory;
        threshold: HarmBlockThreshold;
    }

    enum HarmCategory {
        HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED",
        HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH",
        HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT",
        HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT",
        HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY",
    }

    enum HarmBlockThreshold {
        HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
        BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE",
        BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE",
        BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH",
        BLOCK_NONE = "BLOCK_NONE",
        BLOCK_OFF = "OFF",
    }

    interface BaseParams {
        safetySettings?: SafetySetting[];
        generationConfig?: GenerationConfig;
    }

    interface Content {
        role: string;
        parts: Part[];
    }

    type Part = TextPart;

    interface TextPart {
        text: string;
    }

    interface GenerateContentRequest extends BaseParams {
        contents: Content[];
        systemInstruction?: string | Part | Content;
        model?: string;
    }

    interface GenerationConfig {
        candidateCount?: number;
        stopSequences?: string[];
        maxOutputTokens?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
        /**
         * Output response mimetype of the generated candidate text.
         * Supported mimetype:
         *   `text/plain`: (default) Text output.
         *   `application/json`: JSON response in the candidates.
         */
        responseMimeType?: string;
        /**
         * Output response schema of the generated candidate text.
         * Note: This only applies when the specified `responseMIMEType` supports a schema; currently
         * this is limited to `application/json`.
         */
        responseSchema?: ResponseSchema;
        /**
         * Presence penalty applied to the next token's logprobs if the token has
         * already been seen in the response.
         */
        presencePenalty?: number;
        /**
         * Frequency penalty applied to the next token's logprobs, multiplied by the
         * number of times each token has been seen in the respponse so far.
         */
        frequencyPenalty?: number;
        /**
         * If True, export the logprobs results in response.
         */
        responseLogprobs?: boolean;
        /**
         * Valid if responseLogProbs is set to True. This will set the number of top
         * logprobs to return at each decoding step in the logprobsResult.
         */
        logprobs?: number;
    }

    type ResponseSchema = Schema;
    type Schema = StringSchema | NumberSchema | IntegerSchema | BooleanSchema | ArraySchema | ObjectSchema;

    enum SchemaType {
        /** String type. */
        STRING = "string",
        /** Number type. */
        NUMBER = "number",
        /** Integer type. */
        INTEGER = "integer",
        /** Boolean type. */
        BOOLEAN = "boolean",
        /** Array type. */
        ARRAY = "array",
        /** Object type. */
        OBJECT = "object",
    }

    /**
     * Converts a schema type to a number.
     * @param {SchemaType} type - The schema type to convert.
     * @returns {number} The number corresponding to the schema type.
     */
    const SCHEMA_TYPE_TO_NUMBER: Record<SchemaType, number> = {
        [SchemaType.STRING]: 1,
        [SchemaType.NUMBER]: 2,
        [SchemaType.INTEGER]: 3,
        [SchemaType.BOOLEAN]: 4,
        [SchemaType.ARRAY]: 5,
        [SchemaType.OBJECT]: 6,
    };

    interface BaseSchema {
        /** Optional. Description of the value. */
        description?: string;
        /** If true, the value can be null. */
        nullable?: boolean;
    }

    interface StringSchema extends BaseSchema {
        type: typeof SchemaType.STRING;
        /** If present, limits the result to one of the given values. */
        enum?: string[];
    }

    interface NumberSchema extends BaseSchema {
        type: typeof SchemaType.NUMBER;
        /** Optional. The format of the number. */
        format?: "float" | "double";
    }

    interface IntegerSchema extends BaseSchema {
        type: typeof SchemaType.INTEGER;
        /** Optional. The format of the number. */
        format?: "int32" | "int64";
    }

    interface BooleanSchema extends BaseSchema {
        type: typeof SchemaType.BOOLEAN;
    }

    interface ArraySchema extends BaseSchema {
        type: typeof SchemaType.ARRAY;
        /** A schema describing the entries in the array. */
        items: Schema;
        /** The minimum number of items in the array. */
        minItems?: number;
        /** The maximum number of items in the array. */
        maxItems?: number;
    }

    interface ObjectSchema extends BaseSchema {
        type: typeof SchemaType.OBJECT;
        /** Describes the properties of the JSON object. Must not be empty. */
        properties: {
            [k: string]: Schema;
        };
        /**
         * A list of keys declared in the properties object.
         * Required properties will always be present in the generated object.
         */
        required?: string[];
    }

    /***********************************************
     * The is for AI Studio files
     */

    interface AIStudioFile {
        runSettings: RunSettings;
        systemInstruction: TextPart[];
        chunkedPrompt?: {
            chunks: ChunkedMessage[];
            pendingInputs: ChunkedMessage[];
        };
    }

    interface ChunkedMessage {
        role: string;
        text: string;
        tokenCount?: number;
        isEdited?: boolean;
    }

    interface RunSettings {
        temperature?: number;
        endTokens?: string[]; // End Sequences
        model?: string;
        topP?: number;
        topK?: number;
        maxOutputTokens?: number;
        safetySettings?: SafetySetting[];
        responseMimeType?: string;
        enableCodeExecution?: boolean;
        responseSchema?: ResponseSchema;
        functionDeclarations?: any[];
        enableSearchAsATool?: boolean;
        enableBrowseAsATool?: boolean;
        enableAutoFunctionResponse?: boolean;
    }

    interface GenerateContentRequest extends BaseParams {
        contents: Content[];
        systemInstruction?: string | Part | Content;
        model?: string;
    }

    // Make commands available globally
    (window as any).aiStudioExt ??= {};
    Object.assign((window as any).aiStudioExt, {
        sendMakerSuiteRequest,
        createMakerSuitePrompt,
        convertPromptData,
        findUrl,
        findApiKeys,
    });
    console.debug("new-prompt.ts loaded");
})();