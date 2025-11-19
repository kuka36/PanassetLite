import { GoogleGenAI } from "@google/genai";
import { Asset } from "../types";

const apiKey = process.env.API_KEY || ''; // Fallback handled in UI if missing

export const getPortfolioAnalysis = async (assets: Asset[]) => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  const portfolioSummary = assets.map(a => ({
    symbol: a.symbol,
    name: a.name,
    type: a.type,
    value: (a.quantity * a.currentPrice).toFixed(2),
    allocation: 0 // Calculated by model
  }));

  const prompt = `
    You are a senior financial advisor for "InvestFlow".
    Analyze the following portfolio JSON:
    ${JSON.stringify(portfolioSummary)}

    Please provide:
    1. A brief summary of the asset allocation diversity.
    2. Potential risks based on the asset types (e.g., too much crypto, sector concentration).
    3. Constructive suggestions for rebalancing.
    
    Keep the tone professional yet encouraging. Format with markdown headers.
    Be concise (under 250 words).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};