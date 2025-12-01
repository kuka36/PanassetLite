import { FunctionDeclaration, Type } from "@google/genai";

export function convertSchemaForOpenAI(tools: FunctionDeclaration[]): any[] {
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: convertTypes(tool.parameters)
    }
  }));
}

function convertTypes(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  const result = { ...schema };
  if (result.type && typeof result.type === 'string') {
    result.type = result.type.toLowerCase();
  }

  if (result.properties) {
    const newProps: Record<string, any> = {};
    for (const key in result.properties) {
      newProps[key] = convertTypes(result.properties[key]);
    }
    result.properties = newProps;
  }

  if (result.items) {
    result.items = convertTypes(result.items);
  }

  return result;
}

export function extractToolCallFromText(text: string): { name: string, args: any } | null {
  if (!text) return null;

  try {
    const json = JSON.parse(text);
    if (json.name && json.arguments) return { name: json.name, args: json.arguments };
    if (json.assets) return { name: 'propose_bulk_asset_update', args: json };
    if (Array.isArray(json)) return { name: 'propose_bulk_asset_update', args: { assets: json } };
  } catch (e) { }

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    try {
      const jsonText = codeBlockMatch[1].trim();
      const json = JSON.parse(jsonText);
      if (json.name && json.arguments) return { name: json.name, args: json.arguments };
      if (json.assets) return { name: 'propose_bulk_asset_update', args: json };
      if (Array.isArray(json)) return { name: 'propose_bulk_asset_update', args: { assets: json } };
    } catch (e) { }
  }

  if (text.includes('propose_bulk_asset_update')) {
    const assetsMatch = text.match(/assets\s*=\s*(\[[\s\S]*?\])/);
    const arrayOnlyMatch = text.match(/(\[[\s\S]*?\])/);
    const targetArrayStr = assetsMatch ? assetsMatch[1] : (arrayOnlyMatch ? arrayOnlyMatch[1] : null);

    if (targetArrayStr) {
      let cleaned = targetArrayStr
        .replace(/\w+Assets\(/g, '{')
        .replace(/\)/g, '}')
        .replace(/'/g, '"')
        .replace(/(\w+)\s*=/g, '"$1":');

      cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

      try {
        const assets = JSON.parse(cleaned);
        if (Array.isArray(assets)) {
          return { name: 'propose_bulk_asset_update', args: { assets } };
        }
      } catch (e) { }
    }

    if (text.includes('symbol=') && text.includes('quantity=')) {
      const symbols = [...text.matchAll(/symbol=["'](.+?)["']/g)].map(m => m[1]);
      const names = [...text.matchAll(/name=["'](.+?)["']/g)].map(m => m[1]);
      const quantities = [...text.matchAll(/quantity=([\d.]+)/g)].map(m => parseFloat(m[1]));
      const currentPrices = [...text.matchAll(/currentPrice=([\d.]+)/g)].map(m => parseFloat(m[1]));
      const avgCosts = [...text.matchAll(/avgCost=([\d.]+)/g)].map(m => parseFloat(m[1]));
      const costs = [...text.matchAll(/cost=([\d.]+)/g)].map(m => parseFloat(m[1]));
      const prices = [...text.matchAll(/price=([\d.]+)/g)].map(m => parseFloat(m[1]));

      if (symbols.length > 0 && quantities.length > 0) {
        const assets = symbols.map((s, i) => ({
          symbol: s,
          name: names[i] || s,
          quantity: quantities[i] || 0,
          currentPrice: currentPrices[i] || prices[i] || 0,
          avgCost: avgCosts[i] || costs[i] || 0,
          assetType: 'STOCK'
        }));
        return { name: 'propose_bulk_asset_update', args: { assets } };
      }
    }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const json = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      if (json.assets) return { name: 'propose_bulk_asset_update', args: json };
      if (json.name && json.arguments) return { name: json.name, args: json.arguments };
    } catch (e) { }
  }

  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      const json = JSON.parse(text.substring(firstBracket, lastBracket + 1));
      if (Array.isArray(json)) return { name: 'propose_bulk_asset_update', args: { assets: json } };
    } catch (e) { }
  }

  return null;
}
