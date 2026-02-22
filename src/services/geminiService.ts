import { GoogleGenAI } from "@google/genai";
import type { MaterialItem } from "../types";
import { domainKnowledge } from './domainKnowledge';

// APIキーは環境変数から取得
const getAi = () => new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || "" });

export const chatWithTakahashi = async (messages: any[], masterItems: MaterialItem[], screenContext: string = "LINK_LITE") => {
    // 在庫情報をコンパクトにまとめてAIに渡す（トークン節約と精度向上のため）
    const knowledgeBase = masterItems.slice(0, 150).map(i => ({
        id: i.id, n: i.name, m: i.model, d: i.dimensions, c: i.category
    }));

    const systemInstruction = `
    你是帯広的設備資材专家「AI高橋さん」。
    現在の画面状況: 【${screenContext}】

    【キャラクター】
    - 一人称は「僕」です。
    - 挨拶は「あ、高橋です。」から始めます。
    - 口癖は「なんのせ」です。
    - 帯広弁（北海道弁）を使い、現場の職人さんに親身になって応対します。
    - 在庫がないものでも「意地でも探すべ」という姿勢を見せてください。

    【あなたの最強の武器：業界知識ベース】
    以下の知識を完全に自分のものとして振る舞ってください。
    ${domainKnowledge}

    【行動指針】
    1. **専門用語の解釈**:
       - ユーザーが「SGPの50A」と言ったら、「配管用炭素鋼鋼管 50A」と解釈してください。
       - 「パイレン」は「パイプレンチ」、「全ねじ」は「寸切りボルト」など、現場用語を正確に標準名称に変換・理解してください。

    2. **アクション（通常業務）**:
       currentScreen【${screenContext}】に応じて、適切にアクションを実行してください。
    
    【アクション優先度（超重要）】
    LINK LITE (職人アプリ) では、以下の機能をサポートします。

    1. **カート追加**:
       - ユーザーが「これ注文したい」「持ってきて」「用意して」と言ったら、必ず「カート追加(ADD_CART)」を使ってください。
       - 特に「もってきて」「持ってきて」という言葉には、質問せず即座にカート追加アクションを生成してください。
       - コマンド: <<<ACTION|ADD_CART|[{"id":"資材ID","name":"品名","quantity":数量}]>>>
       - ※資材IDが不明な場合は、品名だけで構いません（IDは空文字""にしてください）。IDがない場合は、LINK側で"未定商品"として扱われます。
       - ※もし在庫 (knowledgeBase) にあるものであれば、そのIDを必ず使ってください。

    【あなたの知識（在庫リストの一部）】
    ${JSON.stringify(knowledgeBase)}
  `;

    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    // APIキーがない、またはプレースホルダーの場合はモックモード
    if (!apiKey || (typeof apiKey === 'string' && (apiKey.includes('PLACEHOLDER') || apiKey === ""))) {
        // Mock logic (simplified for brevity as main focus is connecting with new SDK)
        return {
            text: "あ、高橋です。APIキーが見つからないのでモックモードで動いています。",
            candidates: [],
            isMock: true
        };
    }

    try {
        console.log("Calling Gemini API with model: gemini-3-flash-preview (via @google/genai SDK)");

        // Transform messages to format expected by new SDK if needed, 
        // usually it expects { role: string, parts: { text: string }[] } which matches what we likely have
        // But let's be safe and map it.
        const contents = messages.map(m => ({
            role: m.role,
            parts: m.parts.map((p: any) => p.text ? { text: p.text } : { inlineData: p.inlineData })
        }));

        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: contents, // Note: new SDK might expect 'contents' array directly
            config: {
                systemInstruction: { parts: [{ text: systemInstruction }] }, // New SDK format for system instruction
            }
        });

        // Response structure in new SDK might be slightly different. 
        const candidate = response.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || "";

        return {
            text: text,
            candidates: response.candidates,
        };

    } catch (error) {
        console.error("Gemini API Error (New SDK):", error);
        throw error;
    }
};
