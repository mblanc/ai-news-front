import { GoogleGenAI } from "@google/genai"

const LOCATION = process.env.GOOGLE_CLOUD_LOCATION
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: LOCATION });

export async function generateContent(
    prompt: string,
    model: string = 'gemini-2.5-flash',
    maxOutputTokens: number = 200
): Promise<string | undefined> {
    const config = {
        thinkingConfig: {
            includeThoughts: false,
            thinkingBudget: 0,
        },
        responseMimeType: 'text/plain',
        maxOutputTokens,
        temperature: 0.7,
    };
    
    const response = await ai.models.generateContent({
        model,
        config,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    console.log(response)

    console.log(JSON.stringify(response.candidates![0], null, 2))

    return response.text;
}
