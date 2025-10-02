import { GoogleGenAI, GenerateContentConfig, FunctionDeclaration, FunctionCallingConfigMode, Content } from "@google/genai"
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

const LOCATION = process.env.GOOGLE_CLOUD_LOCATION
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: LOCATION });

export interface ExtractedContent {
    title: string;
    markdown: string;
    excerpt: string;
    byline: string;
    siteName: string;
    originalUrl: string;
}

/**
 * Fetches a URL, extracts its main content using Mozilla Readability,
 * and converts that content to Markdown.
 */
export async function fetchAndConvertToMarkdown(url: string): Promise<ExtractedContent> {
    console.log(`⚙️ Tool executing: Fetching ${url}...`);
    try {
        new URL(url);
    } catch (e) {
        throw new Error(`Invalid URL provided: ${url}`);
    }

    let html: string;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL. Status: ${response.status} ${response.statusText}`);
        }
        html = await response.text();
    } catch (error) {
        throw new Error(`Network error fetching ${url}: ${(error as Error).message}`);
    }

    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article || !article.content) {
        throw new Error('Readability could not find any main content on the page.');
    }

    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        hr: '---',
        bulletListMarker: '-',
    });
    turndownService.remove(['script', 'style', 'iframe', 'nav', 'footer']);

    const markdownBody = turndownService.turndown(article.content);
    const title = article.title || 'Untitled';
    const finalMarkdown = `# ${title}\n\n${markdownBody}`;
    
    console.log(`✅ Tool finished. Extracted "${title}".`);

    return {
        title: title,
        markdown: finalMarkdown,
        excerpt: article.excerpt || '',
        byline: article.byline || '',
        siteName: article.siteName || '',
        originalUrl: url,
    };
}

export const fetchUrlDeclaration: FunctionDeclaration = {
    name: 'fetchAndConvertToMarkdown',
    description: 'Fetches the content of a given URL, extracts the main article text (removing ads, navigation, sidebars), and converts it to Markdown format. Use this whenever you need to read, summarize, or answer questions about the content of a webpage link.',
    parametersJsonSchema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The absolute URL of the webpage to fetch (e.g., https://example.com/article).',
            },
        },
        required: ['url'],
    },
};

// Registry to map function names to their implementation
const toolsRegistry: Record<string, Function> = {
    fetchAndConvertToMarkdown: fetchAndConvertToMarkdown
};


interface GenerateOptions {
    model?: string;
    maxOutputTokens?: number;
    urlContext?: boolean;
}

export async function generateContent(
    prompt: string,
    {
        model = 'gemini-2.0-flash', 
        maxOutputTokens = 800, 
        urlContext = false
    }: GenerateOptions = {}
): Promise<string | undefined> {

    console.log(`Model used: ${model}`);
    console.log(`URL Context: ${urlContext}`);

    const config: GenerateContentConfig = {
        responseMimeType: 'text/plain',
        maxOutputTokens,
        temperature: 0.7,
    };

    if (urlContext == true) {
        config.tools = [{ functionDeclarations: [fetchUrlDeclaration] }]
        config.toolConfig = {
            functionCallingConfig: {
                mode: FunctionCallingConfigMode.AUTO,
            }
        }
    }

    // Start building the conversation history
    const history: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];

    console.log('🤖 Sending initial prompt to Gemini...');
    // Initial call to Gemini
    const response = await ai.models.generateContent({
        model,
        config,
        contents: history,
    });

    // Check if Gemini wants to call a function
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        
        // FIX 1: Ensure call.name exists before using it.
        if (!call.name) {
             console.warn("⚠️ Gemini requested a function call, but no function name was provided.");
             // FIX 2: Use as a property, not a function call
             return response.text;
        }

        console.log(`\n🤖 Gemini requested function call: "${call.name}"`);
        
        // Add Gemini's response (the function call request) to the history
        if (response.candidates?.[0]?.content) {
             history.push(response.candidates[0].content);
        }

        // Execute the function if it exists in our registry
        if (call.name in toolsRegistry) {
            const args = call.args as { url: string };
            let toolOutput;
            try {
                // Call the actual TypeScript function
                toolOutput = await toolsRegistry[call.name](args.url);
            } catch (error) {
                console.error('❌ Tool execution failed:', error);
                toolOutput = { error: (error as Error).message };
            }

            // Add the function's output to the history
            history.push({
                role: 'function',
                parts: [{
                    functionResponse: {
                        name: call.name, 
                        response: {       
                            result: toolOutput 
                        }
                    }
                }]
            });

            console.log('\n📤 Sending tool output back to Gemini for the final answer...');
            
            // Call Gemini AGAIN with the complete history
            const followUpResponse = await ai.models.generateContent({
                model,
                contents: history
            });
            
            // FIX 2: Use as a property, not a function call
            return followUpResponse.text;

        } else {
             console.error(`Unknown function requested: ${call.name}`);
        }
    }

    // If no function was called, just return the initial text response
    // FIX 2: Use as a property, not a function call
    return response.text;
}