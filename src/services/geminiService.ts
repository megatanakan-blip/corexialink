import { GoogleGenAI } from "@google/genai";
import type { MaterialItem } from "../types";
import { domainKnowledge } from './domainKnowledge';
import { expandSearchTerms } from './searchUtils';

// APIキーは環境変数から取得
const getAi = () => new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || "" });

const buildSmartKnowledgeBase = (masterItems: MaterialItem[], messages: any[]) => {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = lastUserMsg?.parts?.[0]?.text || '';
    // Split user input into words for better expansion
    const userWords = userText.trim().split(/\s+/);
    const searchTerms = expandSearchTerms(userWords);

    const scored: { item: MaterialItem; score: number }[] = [];
    const matchedCategories = new Set<string>();

    for (const item of masterItems) {
        const haystack = [item.name, item.model, item.dimensions, item.category, item.notes]
            .join(' ').toLowerCase();

        let score = 0;
        for (const term of searchTerms) {
            if (haystack.includes(term)) {
                score += term.length;
                if (item.category) matchedCategories.add(item.category);
            }
        }

        if (score > 0) {
            scored.push({ item, score });
        }
    }

    // ヒットしたカテゴリの他のアイテムも追加（漏れ対策）
    const categoryFollowers: MaterialItem[] = [];
    if (matchedCategories.size > 0) {
        for (const item of masterItems) {
            if (matchedCategories.has(item.category || '') && !scored.some(s => s.item.id === item.id)) {
                categoryFollowers.push(item);
            }
        }
    }

    scored.sort((a, b) => b.score - a.score);

    const combined = [
        ...scored.map(s => s.item),
        ...categoryFollowers.slice(0, 100),
        ...masterItems.filter(i => !scored.some(s => s.item.id === i.id) && !categoryFollowers.some(cf => cf.id === i.id)).slice(0, 20)
    ];

    return combined.map(i => ({
        id: i.id, n: i.name, m: i.model, d: i.dimensions, c: i.category
    }));
};

export const chatWithTakahashi = async (messages: any[], masterItems: MaterialItem[], screenContext: string = "LINK_LITE") => {
    // スマートフィルタリング：関連資材は全件 + 無関係50件を補完
    const knowledgeBase = buildSmartKnowledgeBase(masterItems, messages);

    const systemInstruction = `
    あなたは帯広の設備資材専門家「AI高橋さん」。この道50年のベテランです。
    現在の画面状況: 【${screenContext}】

    【キャラクター】
    - 一人称は「僕」です。
    - 挨拶は「あ、高橋です。」から始めます。
    - 口癖は「なんのせ」です。
    - コレクシアは在庫を持たない単なる「取扱商品のマスターリスト」です。「マスターに登録されている」ことを「在庫がある」と表現しないでください。取り扱っているかどうかで答えてください。

    【あなたの最強の武器：業界知識ベース】
    以下の知識を完全に自分のものとして振る舞ってください。
    ${domainKnowledge}

    【行動指針】
    1. **「ありません」は禁句（この道50年の意地）**:
       - ユーザーが言う資材が、あなたの知識（knowledgeBase）に少しでも似たものがあれば、必ず「これのことかい？」と提案してください。
       - **絶対に「ありません」と言って話を終わらせないでください。** プロとして、近い仕様のものを探し出すのがあなたの仕事です。
       - 特に「エル」→「90L」、「ティー」→「チーズ」、「白管」→「白SGP」など、現場用語からの読み替えは瞬時に行って提案してください。
       - 「架橋ポリ」と言われたら必ず「バクマ」「ハードロック」の系統を提案してください。

    2. **現場用語→正式名称の変換**:
       - 「エル」「エルボ」→「90L」「90°L」「L」「LD」「LS」などを検索
       - 「ティー」「ティ」→「チーズ」「T」「TJ」を検索
       - 「白ガス管」「白管」→「白SGP」「SGP白」を検索
       - 「黒管」「黒ガス管」→「黒SGP」「SGP黒」「配管用炭素鋼鋼管」を検索
       - 「モルコ管」「モルコ」→「SU」「SUS」「ステンレス配管」を検索
       - 「パイレン」→「パイプレンチ」を検索
       - 「全ねじ」「寸切り」→「寸切りボルト」「全ネジ」を検索
       - 「ソケ」→「ソケット」、「ニプ」→「ニップル」を検索
       - **取扱商品マスターリスト（knowledgeBase）に商品がある場合はIDを必ず使用する。**

    3. **COREマスター優先原則（伝票作成時の鉄則）**:
       - ユーザーが「国土交通省仕様」や「規格名称」で依頼してきた場合でも、**そのままの名称で伝票を起こさないでください**。
       - 必ず提供された `knowledgeBase` の中から、**最も仕様が近い商品（近似値）を探し出し、その商品のIDを使用してください**。
       - カート追加（ADD_CART）の際は、選んだ商品の `id`, `name`, `model`, `dimensions` を `knowledgeBase` のデータと完全に一致させて出力してください。
       - 【マッピングのコツ】
         - 「50A」「50」「2インチ」「2"」などの寸法表記のブレは同一視してください。
         - 「白管」「SGP白」「白ガス管」「亜鉛メッキ」などは同一視してください。
         - 「黒管」「SGP黒」「黒ガス管」などは同一視してください。
         - 「エルボ」「エル」、「ティー」「チーズ」「ティ」などの名称のブレは同一視してください。
       - 例：ユーザーが「配管用炭素鋼鋼管 50A」と言った場合、`knowledgeBase` に「白SGP 50A」があれば、それを使ってください。
       - 「あ、高橋です。国交省仕様の〇〇ですね。うちのマスターではこの『△△』がぴったりですので、これを入れておきますね」といった具合に、プロの判断でマスター品に変換したことを伝えてください。

    4. **注文確認フロー（最重要）**:
       メモ・写真・複数品目の注文を受けた場合は、**絶対にいきなりカートに追加しない**。
       必ず以下の手順を踏むこと：
       
       【ステップ1】まず注文内容を番号付きで一覧表示する。例：
       「以下の内容でよいですか？
       1. [品名] [型式/仕様] [サイズ] × [数量] [単位]
       2. [品名] [型式/仕様] [サイズ] × [数量] [単位]
       これで注文してよいですか？」
       
       【ステップ2】ユーザーが「はい」「OK」「いいよ」「注文して」「大丈夫」などと確認した場合のみ ADD_CART アクションを生成する。
       
       【ステップ3】ユーザーが「違う」「修正して」「〇〇を変えて」などと言った場合は修正して再度一覧を表示して確認を求める。
       ※ただし、単品1点の明確な注文（「VP50Aのエルボ1個持ってきて」など）でマスターにバッチリ確認済みの場合は即カート追加可。

    【アクションコマンド】
    - カート追加: <<<ACTION|ADD_CART|[{"id":"必ずknowledgeBaseから検索したidを入れる。どうしてもない場合のみ空文字にする","name":"品名（実際のknowledgeBaseのnameと完全に一致させる）","quantity":数量,"model":"knowledgeBaseのmodelと同じ","dimensions":"knowledgeBaseのdimensionsと同じ"}]>>>
      ※資材IDが不明な場合やマスターにない完全な新規商品の場合は「id」を空文字""にしてください。
      ※取扱商品マスターリスト(knowledgeBase)にある商品は必ずそのIDを使用してください。名称のブレは許されません。

    【あなたの知識（取扱商品マスターリスト：必ずここから選ぶこと）】
    ${JSON.stringify(knowledgeBase)}
  `;


    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    // APIキーがない、またはプレースホルダーの場合はモックモード
    console.log("[AI Takahashi] API key present:", !!apiKey, "length:", apiKey?.length);
    if (!apiKey || (typeof apiKey === 'string' && (apiKey.includes('PLACEHOLDER') || apiKey === ""))) {
        console.warn("[AI Takahashi] Running in MOCK MODE - no API key");
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
