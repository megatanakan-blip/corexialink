import { GoogleGenAI } from "@google/genai";
import type { MaterialItem } from "../types";
import { domainKnowledge } from './domainKnowledge';

// APIキーは環境変数から取得
const getAi = () => new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || "" });

// 業界用語シノニム辞書（現場用語 → 検索キーワード群）
const INDUSTRY_SYNONYMS: Record<string, string[]> = {
    // エルボ・曲管系
    'エルボ': ['エルボ', 'エル', 'elbow', 'el', '90l', '90°l', '45l', '45°l', 'LD', 'LS', 'LL', '曲管', 'エルボー'],
    'エル': ['エルボ', 'エル', '90L', '90°L', 'L', 'LL', 'LS', 'LD', 'エルボー', '曲管'],
    // チーズ・三叉管系
    'チーズ': ['チーズ', 'ティー', 'tee', 'tj', 'ts', 'tl', 'T管', '三叉', '分岐'],
    'ティー': ['チーズ', 'T', 'TJ', 'TS', 'TL', 'ティ', '三叉', '分岐'],
    'ティ': ['チーズ', 'T', 'TJ', 'TS', '三叉'],
    // ソケット系
    'ソケット': ['ソケット', 'socket', 'sk', 'S', '継手'],
    // ニップル系
    'ニップル': ['ニップル', 'nipple', 'np', 'NI'],
    // ユニオン系
    'ユニオン': ['ユニオン', 'union', 'un'],
    // フランジ系
    'フランジ': ['フランジ', 'flange', 'fl', 'FF', 'RF'],
    // バルブ系
    'バルブ': ['バルブ', 'valve', 'VLV', 'V'],
    'ゲートバルブ': ['ゲートバルブ', 'gate', 'GV', 'ゲート'],
    'ボールバルブ': ['ボールバルブ', 'ball', 'BV', 'ボール'],
    'グローブバルブ': ['グローブバルブ', 'globe', 'GLV', 'グローブ'],
    'チェックバルブ': ['チェックバルブ', 'check', 'CV', 'チェック', '逆止'],
    // キャップ・プラグ
    'キャップ': ['キャップ', 'cap', 'CP', '盲'],
    'プラグ': ['プラグ', 'plug', 'PL'],
    // レジューサー・異径系
    'レジューサー': ['レジューサー', 'reducer', 'RD', 'レデューサ', '異径'],
    // 鋼管系（白ガス・黒管・白管）
    '黒管': ['黒管', '黒SGP', 'SGP黒', '配管用炭素鋼鋼管', 'SGP', 'ガス管', 'GP'],
    '白管': ['白管', '白SGP', 'SGP白', '白ガス管'],
    '白ガス管': ['白SGP', 'SGP白', '白管', 'ガス管', 'SGP'],
    'SGP': ['SGP', '黒管', '白管', '配管用炭素鋼鋼管', 'ガス管'],
    // ステンレス系（モルコ管など）
    'モルコ管': ['SU', 'SUS', 'ステンレス', 'モルコ', 'SA', 'SUS配管'],
    'モルコ': ['SU', 'SUS', 'ステンレス', 'モルコ管'],
    'SUS': ['SUS', 'SU', 'ステンレス', 'stainless', 'SA', 'モルコ管'],
    // 塩ビ系
    'VP': ['VP', '塩ビ', '塩化ビニル', 'PVC'],
    'VU': ['VU', '薄肉塩ビ', '排水用'],
    'HI': ['HI', '耐衝撃', '強化塩ビ'],
    // ポリ系
    'PE': ['PE', 'ポリ', 'ポリエチレン'],
    'PP': ['PP', 'ポリプロ', 'ポリプロピレン'],
    '架橋ポリ': ['架橋ポリ', 'バクマ', 'ハードロック', '架橋ポリエチレン管', 'ポリ管'],
    // 工具系
    'パイレン': ['パイプレンチ', 'パイレン'],
    '全ねじ': ['全ねじ', '寸切り', '寸切', '全ネジ'],
    'バンド': ['バンド', 'ハンガー', '吊り', '吊バンド', '吊りバンド'],
};

const expandSearchTerms = (text: string): string[] => {
    const lower = text.toLowerCase();
    const terms = new Set<string>([lower]);
    for (const [key, synonyms] of Object.entries(INDUSTRY_SYNONYMS)) {
        const allVariants = [key.toLowerCase(), ...synonyms.map(s => s.toLowerCase())];
        if (allVariants.some(v => lower.includes(v))) {
            synonyms.forEach(s => terms.add(s.toLowerCase()));
            terms.add(key.toLowerCase());
        }
    }
    return Array.from(terms);
};

const buildSmartKnowledgeBase = (masterItems: MaterialItem[], messages: any[]) => {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = lastUserMsg?.parts?.[0]?.text || '';
    const searchTerms = expandSearchTerms(userText);

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

    3. **注文確認フロー（最重要）**:
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
    - カート追加: <<<ACTION|ADD_CART|[{"id":"必ずknowledgeBaseのidを入れる。不明な場合は空文字にする","name":"品名（実際のknowledgeBaseのnameと同じにする）","quantity":数量,"model":"knowledgeBaseのmodelと同じ、または推測した型式","dimensions":"knowledgeBaseのdimensionsと同じ、または推測した寸法"}]>>>
      ※資材IDが不明な場合やマスターにない完全な新規商品の場合は「id」を空文字""にしてください。IDがない場合でも必ず「name」「model」「dimensions」は分けて出力してください。全てを「name」に繋げて出力してはいけません。
      ※取扱商品マスターリスト(knowledgeBase)にある商品は必ずそのIDを使用してください。

    【あなたの知識（取扱商品マスターリスト）】
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
