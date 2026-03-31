import { GoogleGenAI } from "@google/genai";
import type { MaterialItem } from "../types";
import { domainKnowledge } from './domainKnowledge';
import { expandSearchTerms, normalizeForSearch } from './searchUtils';

// APIキーは環境変数から取得
const getAi = () => new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || "" });

// 短い確認メッセージ（「はい」「発注して」など）の検出
const CONFIRMATION_PATTERNS = /^(はい|yes|ok|いいよ|大丈夫|お願い|発注|注文|カートに|追加|進めて|いいです|それで|おk|おけ|いける|そうして|やって|頼む|頼みます|了解|りょうかい|おっけ|行って|やってくれ|進める|合ってる|そうそう|ぴったり|その通り)/i;

const buildSmartKnowledgeBase = (masterItems: MaterialItem[], messages: any[]) => {
    if (!masterItems || masterItems.length === 0) return [];

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = lastUserMsg?.parts?.[0]?.text || '';

    // ===== 戦略1: 写真（画像）が含まれる場合 → 全件マスターを渡す =====
    const hasImage = lastUserMsg?.parts?.some((p: any) => p.inlineData) === true;
    // 会話履歴の直近3件も確認（確認メッセージ後の画像など）
    const recentMsgsHaveImage = messages.slice(-4).some((m: any) =>
        m.parts?.some((p: any) => p.inlineData)
    );

    if (hasImage || recentMsgsHaveImage) {
        console.log('[KnowledgeBase] 写真メッセージ検出 → 全件マスター送信');
        // 全件送信（最大500件）
        return masterItems.slice(0, 500).map(i => ({
            id: i.id, n: i.name, m: i.model, d: i.dimensions, c: i.category
        }));
    }

    // ===== 戦略2: 短い確認メッセージの場合 → 会話履歴を遡ってキーワード抽出 =====
    const isConfirmation = !userText.trim() || CONFIRMATION_PATTERNS.test(userText.trim());
    if (isConfirmation) {
        console.log('[KnowledgeBase] 確認メッセージ検出 → 会話履歴からキーワード抽出');
        // 直近の会話（モデルの返答含む）から全テキストを抽出してキーワード化
        const historyText = messages
            .slice(-8) // 直近8メッセージ
            .flatMap((m: any) => m.parts?.filter((p: any) => p.text).map((p: any) => p.text) || [])
            .join(' ');
        const historyWords = historyText.trim().split(/[\s、。\n]+/).filter(w => w.length > 1);
        const historyTerms = expandSearchTerms(historyWords);

        const scored: { item: MaterialItem; score: number }[] = [];
        const matchedCategories = new Set<string>();

        for (const item of masterItems) {
            const nName = normalizeForSearch(item.name || '');
            const nModel = normalizeForSearch(item.model || '');
            const nDim = normalizeForSearch(item.dimensions || '');
            const nCat = normalizeForSearch(item.category || '');
            const haystack = [nName, nModel, nDim, nCat].join(' ');

            let score = 0;
            for (const term of historyTerms) {
                if (term.length > 1 && haystack.includes(term)) {
                    score += term.length;
                    if (item.category) matchedCategories.add(item.category);
                }
            }
            if (score > 0) scored.push({ item, score });
        }

        scored.sort((a, b) => b.score - a.score);

        // 関連カテゴリの全アイテムも含める
        const categoryItems: MaterialItem[] = [];
        if (matchedCategories.size > 0) {
            for (const item of masterItems) {
                if (matchedCategories.has(item.category || '') && !scored.some(s => s.item.id === item.id)) {
                    categoryItems.push(item);
                }
            }
        }

        // スコア付きアイテム + 同カテゴリ全件 + 補完50件
        const combined = [
            ...scored.map(s => s.item),
            ...categoryItems,
            ...masterItems.filter(i =>
                !scored.some(s => s.item.id === i.id) && !categoryItems.some(c => c.id === i.id)
            ).slice(0, 50)
        ];

        console.log(`[KnowledgeBase] 履歴抽出: scored=${scored.length}, category=${categoryItems.length}, total=${combined.length}`);

        // 確認フロー時はより多く（最大500件）渡して漏れを防ぐ
        return combined.slice(0, 500).map(i => ({
            id: i.id, n: i.name, m: i.model, d: i.dimensions, c: i.category
        }));
    }

    // ===== 戦略3: 通常テキスト検索 =====
    const userWords = userText.trim().split(/\s+/);
    const searchTerms = expandSearchTerms(userWords);

    const scored: { item: MaterialItem; score: number }[] = [];
    const matchedCategories = new Set<string>();

    for (const item of masterItems) {
        const nName = normalizeForSearch(item.name || '');
        const nModel = normalizeForSearch(item.model || '');
        const nDim = normalizeForSearch(item.dimensions || '');
        const nCat = normalizeForSearch(item.category || '');
        const nNotes = normalizeForSearch((item as any).notes || '');
        const haystack = [nName, nModel, nDim, nCat, nNotes].join(' ');

        let score = 0;
        for (const term of searchTerms) {
            if (haystack.includes(term)) {
                score += term.length;
                if (item.category) matchedCategories.add(item.category);
            }
        }
        if (score > 0) scored.push({ item, score });
    }

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
        ...masterItems.filter(i =>
            !scored.some(s => s.item.id === i.id) && !categoryFollowers.some(cf => cf.id === i.id)
        ).slice(0, 20)
    ];

    return combined.map(i => ({
        id: i.id, n: i.name, m: i.model, d: i.dimensions, c: i.category
    }));
};

export const chatWithTakahashi = async (
    messages: any[], 
    masterItems: MaterialItem[], 
    screenContext: string = "LINK_LITE",
    extraContext?: { cart?: any, orderHistory?: any[] }
) => {
    // スマートフィルタリング：関連資材は全件 + 無関係50件を補完
    const knowledgeBase = buildSmartKnowledgeBase(masterItems, messages);

    const currentCartStr = extraContext?.cart && Object.keys(extraContext.cart).length > 0
        ? JSON.stringify(Object.values(extraContext.cart).map((c: any) => ({ n: c.item.name, m: c.item.model, d: c.item.dimensions, q: c.quantity })))
        : "空";

    const orderHistoryStr = extraContext?.orderHistory && extraContext.orderHistory.length > 0
        ? JSON.stringify(extraContext.orderHistory.slice(0, 5).map((s: any) => ({ 
            date: s.date, 
            items: s.items.map((i: any) => `${i.name} ${i.model} ${i.dimensions} x${i.quantity}`) 
        })))
        : "なし";

    const systemInstruction = `
    あなたは帯広の設備資材専門家「AI高橋さん」。この道50年のベテランです。
    現在の画面状況: 【${screenContext}】

    【現在の状況（最重要：重複注文防止のため）】
    - 現在のカートの中身: ${currentCartStr}
    - 直近の注文履歴: ${orderHistoryStr}
    
    ※ユーザーから「追加」と言われた場合、上記の「カートの中身」や「注文履歴」にあるものは、既に手配済みかカートに入っています。
    ※**ADD_CARTアクションでは「今回の発言で新しく追加する分」の数量だけを出力してください。**
    ※既にカートにある商品の数量を「増やす」場合は、増分（追加分）だけを数量として指定してください。
    
    例：既に「全ねじ」が5本カートにある状態で、「あと5本追加」と言われたら、ADD_CARTでは quantity: 5 を出力します（10にしないでください。UI側で加算されます）。
    
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

     2. **手書きメモ写真の読み取り原則（重要）**:
        手書きのメモや写真から品目を読み取る際は以下の業界常識マッピングを必ず適用してください。

        【業界常識マッピング（必ず適用）】
        - 「白管」「白ガス管」「白パイプ」= 白SGP（亜鉛メッキ鋼管） knowledgeBaseで「白SGP」を検索
        - 「黒管」「黒ガス管」「黒パイプ」= 黒SGP（配管用炭素鋼鋼管） knowledgeBaseで「黒SGP」を検索
        - 「L」= エルボ  knowledgeBaseでmodel=Lを検索
        - 「S」= ソケット  knowledgeBaseでmodel=Sを検索

        ADD_CARTのmodelフィールドにはメモの型式コードをそのまま入れること（L, S等）。
        ADD_CARTのnameにはknowledgeBaseで見つけた品名を使うこと（見つからなければ業界変換後の名称）。
        **knowledgeBaseに商品がある場合はIDを必ず使用する。**

     3. **COREマスター優先原則（伝票作成時の鉄則）**:
        - 必ず提供された knowledgeBase の中から最も仕様が近い商品を探し出しそのIDを使用してください。
        - カート追加（ADD_CART）の際は選んだ商品のid, name, model, dimensionsをknowledgeBaseのデータと完全に一致させて出力してください。
         - 【マッピングのコツ】
           - 「白管」「白ガス管」= 白SGP（業界常識）。knowledgeBaseで「白SGP」を探す。
           - 「黒管」「黒ガス管」= 黒SGP（業界常識）。knowledgeBaseで「黒SGP」を探す。
           - 「50A」「50」「2インチ」などの寸法表記のブレは同一視してください。
           - 「エルボ」「エル」「ティー」「チーズ」などの名称のブレは同一視してください。
           - ⚠️**最重要禁止事項**：「エルボ」「L」「ソケット」「S」の注文で、「CKMA（カムロック式）」は絶対に選ばないでください。CKMAは特殊な工業ホース継手であり、通常の白ガス管継手としては使いません。必ず「白ねじ込み継手」や通常の「白継手」を探してください。
           - **全ねじ（全ネジ・寸切りボルト）の選定規則**：
             - 特に材質や長さの指定がない場合は、**「メッキ全ねじ 3/8 2m」** を標準として選んでください。
             - 現場では「全ねじ」「寸切り」と言われたら 2m のメッキ品を出すのが常識です。
             - 指定がない限り「ステンレス」や「1m」は選ばないでください。
           
           - 全ネジは材質指定がない場合は材質を勝手に追加しないこと。
           - ⚠️短管は切り売り品。「白管 20A」の注文で短管を代替品として選ばないこと。
           - ⚠️材質（ステン等）は明示されていない限り勝手に追加しないこと。

    4. **注文確認フロー（最重要・写真メモも同様）**:
       メモ・写真・複数品目の注文を受けた場合は、**絶対にいきなりカートに追加しない**。
       必ず以下の手順を踏むこと：
       
       【ステップ1・写真/メモ読み取り時の絶対ルール】
       写真やメモから商品を読み取ったら、**その場でknowledgeBaseを検索して**、最も近い商品を特定すること。
       確認リストには必ず「knowledgeBaseから見つけた正式商品名」を使い、「**」などのマークアップは使わないこと。
       
       確認リストの形式（knowledgeBaseの正式名称を使うこと）：
       「以下の内容でよいですか？
       1. [knowledgeBaseのn（品名）] [knowledgeBaseのm（型式）] [knowledgeBaseのd（寸法）] × [数量]
       2. [knowledgeBaseのn（品名）] [knowledgeBaseのm（型式）] [knowledgeBaseのd（寸法）] × [数量]
       これで注文してよいですか？」
       
       ⚠️絶対に写真から読んだ文字をそのまま品名にしないこと。必ずknowledgeBaseで照合すること。
       
       【ステップ2】ユーザーが「はい」「OK」「いいよ」「注文して」「大丈夫」「発注して」などと確認した場合のみ ADD_CART アクションを生成する。
       ADD_CARTで出力するid/name/model/dimensionsはステップ1で特定したknowledgeBaseのデータをそのまま使う（変更禁止）。
       
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
