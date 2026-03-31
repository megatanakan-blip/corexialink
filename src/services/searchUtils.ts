import type { MaterialItem } from '../types';

/**
 * Industry synonyms dictionary for mapping field terms to master keywords.
 */
export const INDUSTRY_SYNONYMS: Record<string, string[]> = {
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
    'VP': ['VP', '塩ビ', '塩化ビニル', 'PVC', '硬質ポリ塩化ビニル管'],
    'VU': ['VU', '薄肉塩ビ', '排水用', '硬質ポリ塩化ビニル管'],
    'HI': ['HI', '耐衝撃', '強化塩ビ'],
    // ポリ系
    'PE': ['PE', 'ポリ', 'ポリエチレン'],
    'PP': ['PP', 'ポリプロ', 'ポリプロピレン'],
    '架橋ポリ': ['架橋ポリ', 'バクマ', 'ハードロック', '架橋ポリエチレン管', 'ポリ管'],
    // 工具系
    'パイレン': ['パイプレンチ', 'パイレン'],
    'バンド': ['バンド', 'ハンガー', '吊り', '吊バンド', '吊りバンド'],
    // 国土交通省仕様・JIS規格名
    '配管用炭素鋼鋼管': ['SGP', '黒管', '白管', 'ガス管', 'GP'],
    '圧力配管用炭素鋼鋼管': ['STPG', 'スケ番', 'Sch'],
    '一般配管用ステンレス鋼管': ['SU', 'SUS', 'モルコ', 'ステンレス'],
    '配管用ステンレス鋼管': ['SUS', 'ステンレス'],
    '硬質ポリ塩化ビニル管': ['VP', 'VU', '塩ビ', 'PVC'],
    '水道用硬質塩化ビニルライニング鋼管': ['SGP-VA', 'SGP-VB', 'SGP-VD', 'ライニング管', 'VA', 'VB', 'VD', 'V-LP'],
    '水配管用亜鉛めっき鋼管': ['SGPW', '白管', 'W', 'SGP-W'],
    // 継手種類
    '白L': ['白ねじ込み継手', '90L', 'エルボ', 'エル'],
    'S': ['ソケット', '白ねじ込み継手', 'SK'],
    '白ガス': ['白ガス管', 'SGP-W', '白SGP'],
    '全ねじ': ['全ねじ', '寸切り', '寸切', '全ネジ', '寸切ボルト', '全ねじボルト'],
    '寸切り': ['全ねじ', '寸切り', '寸切', '全ネジ', '寸切ボルト', '全ねじボルト'],
    '全ネジ': ['全ねじボルト', '寸切り', 'W3/8', '3/8'],
    '径違い': ['異径', 'レジューサー', 'RD', 'RC', '異径継手'],
    '異径': ['径違い', 'レジューサー', 'RD', 'RC', '異径継手'],
    'めねじ': ['メス', '内ねじ', 'ねじ込'],
    'おねじ': ['オス', '外ねじ', 'ねじ込'],
    // サイズ対応（インチ呼び ↔ A呼び ↔ 分呼び）
    '3/8': ['3分', '10A', '10'],
    '1/2': ['15A', '15', '4分'],
    '3/4': ['20A', '20', '6分'],
    '1': ['25A', '25', '1インチ'],
    '1-1/4': ['32A', '32', '1-1/4', '1インチ1/4', 'インチ2'],
    '1-1/2': ['40A', '40', '1-1/2', '1インチ1/2', 'インチ4'],
    '2': ['50A', '50', '2インチ'],
    '2-1/2': ['65A', '65'],
    '3': ['80A', '80'],
    '4': ['100A', '100'],
    // 逆引き
    '15A': ['1/2', '15', '4分'],
    '20A': ['3/4', '20', '6分'],
    '25A': ['1', '25', '1インチ'],
    '32A': ['1-1/4', '32', 'インチ2'],
    '40A': ['1-1/2', '40', 'インチ4'],
    '50A': ['2', '50', '2インチ'],
    '65A': ['2-1/2', '65'],
    '80A': ['3', '80'],
    '100A': ['4', '100'],
};

/**
 * Expands search terms with synonyms.
 */
export const expandSearchTerms = (keywords: string[]): string[] => {
    const expanded = new Set<string>();
    keywords.forEach(k => {
        expanded.add(k);
        const lowerK = k.toLowerCase();
        
        for (const [key, synonyms] of Object.entries(INDUSTRY_SYNONYMS)) {
            const allVariants = [key.toLowerCase(), ...synonyms.map(s => s.toLowerCase())];
            if (allVariants.some(v => lowerK.includes(v) || v.includes(lowerK))) {
                synonyms.forEach(s => expanded.add(s.toLowerCase()));
                expanded.add(key.toLowerCase());
            }
        }
    });
    return Array.from(expanded);
};

/**
 * Normalizes text for search by:
 * 1. Converting Hiragana to Katakana
 * 2. Converting Full-width alphanumeric characters to Half-width
 * 3. Converting Half-width Katakana to Full-width Katakana
 * 4. Converting to lowercase
 * 5. Trimming whitespace
 */
export const normalizeForSearch = (text: string): string => {
    if (!text) return '';
    
    let normalized = text.trim();

    // 1. Hiragana to Katakana
    normalized = normalized.replace(/[\u3041-\u3096]/g, (match) => {
        const chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });

    // 2. Full-width alphanumeric/symbols to Half-width
    normalized = normalized.replace(/[！-～]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) - 0xfee0);
    });

    // 3. Half-width Katakana to Full-width Katakana
    const kanaMap: Record<string, string> = {
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
        'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
        'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
        'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
        'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
        'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
        'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
        'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
        'ﾞ': '゛', 'ﾟ': '゜', 'ｰ': 'ー', ' ': '　'
    };
    normalized = normalized.split('').map(char => kanaMap[char] || char).join('');

    // Handle voiced/semi-voiced sounds in half-width (simplified approach)
    normalized = normalized.replace(/カ゛/g, 'ガ').replace(/キ゛/g, 'ギ').replace(/ク゛/g, 'グ').replace(/ケ゛/g, 'ゲ').replace(/コ゛/g, 'ゴ')
        .replace(/サ゛/g, 'ザ').replace(/シ゛/g, 'ジ').replace(/ス゛/g, 'ズ').replace(/セ゛/g, 'ゼ').replace(/ソ゛/g, 'ゾ')
        .replace(/タ゛/g, 'ダ').replace(/チ゛/g, 'ヂ').replace(/ツ゛/g, 'ヅ').replace(/テ゛/g, 'デ').replace(/ト゛/g, 'ド')
        .replace(/ハ゛/g, 'バ').replace(/ヒ゛/g, 'ビ').replace(/フ゛/g, 'ブ').replace(/ヘ゛/g, 'ベ').replace(/ホ゛/g, 'ボ')
        .replace(/ハ゜/g, 'パ').replace(/ヒ゜/g, 'ピ').replace(/フ゜/g, 'プ').replace(/ヘ゜/g, 'ペ').replace(/ホ゜/g, 'ポ');

    // 4. Lowercase
    normalized = normalized.toLowerCase();

    // 5. Replace full-width space and symbols with half-width space for consistency
    // Symbols like ( ) [ ] { } - / . ° are treated as word separators
    normalized = normalized.replace(/[　\(\)\[\]\{\}\-\/\.・°]/g, ' ');

    // 6. Handle common concatenated terms like "白SGP" -> "白 SGP"
    normalized = normalized.replace(/(白|黒|sgp|sus|vp|vu)(白|黒|sgp|sus|vp|vu)/g, '$1 $2');
    normalized = normalized.replace(/(白|黒|sgp|sus|vp|vu)(\d+)/g, '$1 $2'); // SGP50 -> SGP 50
    normalized = normalized.replace(/(\d+)(a|b|インチ)/g, '$1 $2'); // 50A -> 50 A

    // Final cleanup of multiple spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
};

export const escapeRegExp = (text: string): string => {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const calculateRelevanceScore = (item: MaterialItem, keywords: string[]): number => {
    if (keywords.length === 0) return 0;

    let totalScore = 0;

    const fields = {
        name: normalizeForSearch(item.name || ''),
        model: normalizeForSearch(item.model || ''),
        dimensions: normalizeForSearch(item.dimensions || ''),
        manufacturer: normalizeForSearch(item.manufacturer || ''),
        category: normalizeForSearch(item.category || ''),
        location: normalizeForSearch(item.location || '')
    };

    // 1. AND filter logic (MUST match all keywords somewhere)
    // For each keyword, check if it or any of its synonyms matches.
    const matchesAll = keywords.every(k => {
        const kExpanded = expandSearchTerms([k]);
        
        return kExpanded.some(term => {
            let regexSource = escapeRegExp(term);
            if (/^[a-z]+$/.test(term)) {
                 regexSource = `(^|[^a-z])${regexSource}($|[^a-z])`;
            } else if (/^[0-9]+$/.test(term)) {
                 regexSource = `(^|[^0-9])${regexSource}($|[^0-9])`;
            }
            
            const strictRegex = new RegExp(regexSource, 'i');
            
            return (
                strictRegex.test(fields.name) || 
                strictRegex.test(fields.model) || 
                strictRegex.test(fields.dimensions) || 
                strictRegex.test(fields.manufacturer) || 
                strictRegex.test(fields.category) ||
                strictRegex.test(fields.location)
            );
        });
    });

    if (!matchesAll) return -1;

    // 2. Full query match boost (across name, model, dimensions)
    const combinedKeyFields = `${fields.name} ${fields.model} ${fields.dimensions}`.trim();
    const fullQuery = keywords.join(' ');
    
    // Exact match (ignoring whitespace)
    const strippedKey = combinedKeyFields.replace(/\s+/g, '');
    const strippedQuery = fullQuery.replace(/\s+/g, '');
    if (strippedKey === strippedQuery) totalScore += 15000;
    else if (combinedKeyFields === fullQuery) totalScore += 10000;
    
    // Bag-of-words exact match (handles order like "白SGP" vs "SGP白")
    const masterWords = fields.name.split(/\s+/).filter(w => w.length > 0);
    if (masterWords.length > 0 && masterWords.length === keywords.length && masterWords.every(w => keywords.includes(w))) {
        totalScore += 12000;
    }
    
    if (combinedKeyFields.startsWith(fullQuery)) totalScore += 5000;

    keywords.forEach((k, idx) => {
        // Higher weight for the first keyword
        const multiplier = idx === 0 ? 2 : 1;
        const kExpanded = expandSearchTerms([k]);

        kExpanded.forEach(expandedK => {
            const escapedK = escapeRegExp(expandedK);
            // Synonym matches are weighted slightly less than original keyword if we wanted, 
            // but for now let's just make them count. 
            // We'll use a matchMultiplier: 1.0 for original, 0.8 for synonyms.
            const matchMultiplier = expandedK === k ? 1.0 : 0.8;
            const weight = multiplier * matchMultiplier;

            // 3. Exact matches (Absolute priority)
            if (fields.model === expandedK) totalScore += 5000 * weight;
            if (fields.dimensions === expandedK) totalScore += 4000 * weight;
            if (fields.name === expandedK) totalScore += 3000 * weight;

            // 4. Boundary matches
            let bRegexSource = escapedK;
            if (/^[a-z]+$/.test(expandedK)) {
                 bRegexSource = `(^|[^a-z])${escapedK}($|[^a-z])`;
            } else if (/^[0-9]+$/.test(expandedK)) {
                 bRegexSource = `(^|[^0-9])${escapedK}($|[^0-9])`;
            } else {
                 bRegexSource = `(^|[\\s\\-/$])${escapedK}($|[\\s\\-/$])`;
            }

            const boundaryRegex = new RegExp(bRegexSource, 'i');
            if (boundaryRegex.test(fields.model)) totalScore += 1000 * weight;
            if (boundaryRegex.test(fields.dimensions)) totalScore += 800 * weight;
            if (boundaryRegex.test(fields.name)) totalScore += 600 * weight;

            // 5. Starts-with matches
            if (fields.model.startsWith(expandedK)) totalScore += 500 * weight;
            if (fields.dimensions.startsWith(expandedK)) totalScore += 400 * weight;
            if (fields.name.startsWith(expandedK)) totalScore += 300 * weight;
            if (fields.manufacturer.startsWith(expandedK)) totalScore += 100 * weight;

            // 6. Basic presence
            if (fields.name.includes(expandedK)) totalScore += 50 * weight;
            if (fields.model.includes(expandedK)) totalScore += 40 * weight;
            if (fields.dimensions.includes(expandedK)) totalScore += 30 * weight;
            if (fields.manufacturer.includes(expandedK)) totalScore += 20 * weight;
            if (fields.category.includes(expandedK)) totalScore += 10 * weight;
            if (fields.location.includes(expandedK)) totalScore += 5 * weight;
        });
    });

    return totalScore;
};

export const filterAndSortItems = (items: MaterialItem[], query: string): MaterialItem[] => {
    const normalizedQuery = normalizeForSearch(query);
    const keywords = normalizedQuery.split(' ').filter(k => k.length > 0);
    if (keywords.length === 0) return items;

    return items
        .map(item => ({ item, score: calculateRelevanceScore(item, keywords) }))
        .filter(result => result.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map(result => result.item);
};
