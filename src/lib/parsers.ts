// ====================================
// 常量定义 - 文件格式和垃圾识别规则
// ====================================

/**
 * 视频文件扩展名集合
 * 用于识别哪些文件需要被整理
 */
export const VIDEO_EXTS = new Set([".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".ts", ".m2ts", ".webm", ".rmvb", ".iso"]);

/**
 * 字幕文件扩展名集合
 * 字幕文件会跟随视频文件一起整理
 */
export const SUB_EXTS = new Set([".srt", ".ass", ".ssa", ".vtt", ".sub", ".idx", ".sup"]);

/**
 * 特殊目录名集合（杂项、元数据目录）
 * 这些目录通常是系统生成的或无用的，应该被清理
 */
export const MISC_DIR_NAMES = new Set(["@eadir", "__macosx", ".ds_store", "sample", "samples", "screens", "screen", "screenshots", "extras", "extra", "bonus", "bts", "poster", "posters", "fanart", "thumb", "thumbs", "artwork", "cd1", "cd2", "subs", "sub", "subtitle", "subtitles", "字幕", "字幕组"]);

/**
 * 垃圾文件名标记
 * 包含这些字符串的文件通常是广告或无用文件
 */
export const JUNK_MARKERS = ["www.", ".com", ".net", ".org", "dygm", "dygod", "ygdy8", "piaohua", "迅雷", "下载", "资源", "首发", ".pdf", ".txt", "免费", "搜索"];

// ====================================
// 正则表达式 - 用于解析文件名格式
// ====================================

/**
 * 标准剧集格式正则: S01E01, S1E1
 * 匹配季号(1-2位)和集号(1-3位)
 */
const SXXEYY_RE = /S(\d{1,2})\s*E(\d{1,3})/i;

/**
 * 简化集数格式正则: EP01, E01
 * 只匹配集号，不包含季号
 */
const EP_NUM_RE = /\b(?:EP|E)(\d{1,3})\b/i;

/**
 * 年份提取正则: (2020), [2020], .2020.
 * 匹配1900-2099之间的年份，支持多种分隔符
 */
const YEAR_REGEX = /(?:^|[\.\s\(\[])(19\d{2}|20\d{2})(?:$|[\.\s\)\]])/;

/**
 * 电影文件名噪音过滤模式
 * 用于从电影文件名中移除技术参数和无关信息
 */
const MOVIE_NOISE_PATTERNS = [
    /\b(1080[pP]|2160[pP]|720[pP]|4[kK]|8[kK])\b/gi,                                  // 分辨率标签
    /\b(BluRay|REMUX|WEB-?DL|WEBRip|HDTV|DVDRip|BDRip|UHD)\b/gi,                    // 来源标签
    /\b(H\.?264|H\.?265|x264|x265|HEVC|AVC|DDP|AAC|AC3|DTS-HD|TrueHD|Atmos|HDR|DV|DoVi|10bit|10-bit)\b/gi,  // 编码/音频格式
    /\b(Repack|Proper|Limited|Complete|Uncut|Extended|Director's Cut|DC)\b/gi,       // 版本类型
    /(\[.*?\]|\(.*?\)|【.*?】|〔.*?〕)/g,                                              // 括号内容
    /(\d+(?:-\d+)?部|合集|系列|Collection|Trilogy|Saga|动漫)/g,                       // 合集标记
    /(电影|制片厂)/g                                                                  // 通用标记
];

// ====================================
// 工具函数 - 文本处理和格式化
// ====================================

/**
 * 规范化空格字符
 * 将不间断空格(U+00A0)转换为普通空格，并合并多个空格为一个
 * 
 * @param s - 输入字符串
 * @returns 规范化后的字符串
 * 
 * @example
 * normalizeSpaces("hello  world") // "hello world"
 * normalizeSpaces("hello\u00A0world") // "hello world"
 */
export function normalizeSpaces(s: string): string {
    if (!s) return "";
    return s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * 全角字符转半角
 * 将全角字符(主要是中文输入法产生的)转换为半角ASCII字符
 * 这样可以统一处理中英文混合的文件名
 * 
 * @param s - 输入字符串
 * @returns 转换后的字符串
 * 
 * @example
 * toHalfWidth("ＨＤ１０８０ｐ") // "HD1080p"
 * toHalfWidth("　") // " " (全角空格转半角)
 */
export function toHalfWidth(s: string): string {
    if (!s) return "";
    return s.split('').map(char => {
        const code = char.charCodeAt(0);
        // 全角空格(U+3000)转普通空格
        if (code === 0x3000) return ' ';
        // 全角ASCII字符(U+FF01-U+FF5E)转半角
        if (code >= 0xFF01 && code <= 0xFF5E) return String.fromCharCode(code - 0xFEE0);
        return char;
    }).join('');
}

/**
 * 清理剧集查询字符串
 * 移除季号、质量标签、括号等信息，保留纯粹的剧集名称
 * 用于 TMDB 搜索时提高匹配准确度
 * 
 * @param text - 原始文件夹名
 * @returns 清理后的查询字符串
 * 
 * @example
 * cleanSeriesQuery("权力的游戏.S01.1080p") // "权力的游戏"
 * cleanSeriesQuery("Game.of.Thrones.Season.1.WEB-DL") // "Game of Thrones"
 */
export function cleanSeriesQuery(text: string): string {
    let t = toHalfWidth(text);
    
    // 移除季号信息: S01, Season 1, 第1季等
    t = t.replace(/(S\d{1,2}(?:-S\d{1,2})?|Season\s*\d+|第?\s*\d+(?:-\d+)?\s*[季部])/gi, " ");
    
    // 移除质量标签
    t = t.replace(/(1080[pP]|2160[pP]|4[kK]|8[kK]|HDR|DV|WEB-DL|H\d{3}|AAC|DDP)/gi, " ");
    
    // 移除各种括号及其内容
    t = t.replace(/(\[.*?\]|\(.*?\)|【.*?】)/g, " ");

    // 点号通常用作单词分隔符，转为空格
    t = t.replace(/\./g, " ");
    return normalizeSpaces(t);
}

/**
 * 清理电影文件名中的噪音
 * 移除所有技术参数、版本信息等，只保留电影名称
 * 
 * @param text - 原始文件名
 * @returns 清理后的电影名称
 * 
 * @example
 * cleanMovieNoise("Inception.2010.1080p.BluRay.x264") // "Inception"
 */
export function cleanMovieNoise(text: string): string {
    let t = text;
    for (const pat of MOVIE_NOISE_PATTERNS) {
        t = t.replace(pat, " ");
    }
    return t.replace(/\./g, " ").trim();
}


/**
 * 从电影文件名中提取标题和年份
 * 
 * 算法逻辑:
 * 1. 先转换全角字符为半角
 * 2. 使用正则表达式匹配年份(1900-2099)
 * 3. 如果找到年份，将年份前的部分作为标题
 * 4. 清理标题中的技术参数和噪音
 * 
 * @param rawName - 原始文件名
 * @returns 包含标题和年份的对象
 * 
 * @example
 * extractMovieInfo("盗梦空间.Inception.2010.1080p.mkv")
 * // { title: "盗梦空间 Inception", year: 2010 }
 * 
 * extractMovieInfo("肖申克的救赎.BluRay.1080p")
 * // { title: "肖申克的救赎", year: null }
 */
export function extractMovieInfo(rawName: string): { title: string, year: number | null } {
    const t = toHalfWidth(rawName);
    const mYear = t.match(YEAR_REGEX);
    
    let title = "";
    let year = null;

    if (mYear && mYear[1]) {
        year = parseInt(mYear[1], 10);
        // 使用exec获取匹配位置
        const match = YEAR_REGEX.exec(t);
        if (match) {
             // 年份之前的内容作为标题
             title = cleanMovieNoise(t.substring(0, match.index));
        }
    } else {
        // 没有年份就清理整个字符串
        title = cleanMovieNoise(t);
    }
    
    return { title: normalizeSpaces(title), year };
}

/**
 * 从文件名中解析集数信息
 * 
 * 优先级顺序 (从高到低):
 * 1. SxxEyy 格式 (如 S01E01) - 最标准的格式
 * 2. 中文格式 (如 "第01集") - 支持中文表述
 * 3. EPxx 格式 (如 EP01, E01) - 简化格式
 * 4. 文件名末尾数字 (如 "name-01.mp4") - 兼容格式
 * 5. 纯数字文件名 - 最后的兜底方案
 * 
 * @param name - 文件名(包含扩展名)
 * @returns 包含季号和集号的对象，无法识别返回null
 * 
 * @example
 * parseEpisodeFromName("Game.of.Thrones.S01E05.mp4")
 * // { season: 1, episode: 5 }
 * 
 * parseEpisodeFromName("权力的游戏.第10集.mp4")
 * // { season: null, episode: 10 }
 * 
 * parseEpisodeFromName("EP03.mkv")
 * // { season: null, episode: 3 }
 */
export function parseEpisodeFromName(name: string): { season: number | null, episode: number | null } {
    // 移除扩展名，只处理文件名主体
    const stem = name.replace(/\.[^/.]+$/, "");
    
    // 1. 标准格式: SxxEyy
    const m1 = stem.match(/S(\d{1,2})\s*E(\d{1,3})/i);
    if (m1) return { season: parseInt(m1[1]), episode: parseInt(m1[2]) };
    
    // 2. 中文格式: "第x集/话/回"
    const m2 = stem.match(/第\s*(\d{1,4})\s*[集话回]/);
    if (m2) return { season: null, episode: parseInt(m2[1]) };

    // 3. 简化格式: EPxx, Exx
    const m3 = stem.match(EP_NUM_RE);
    if (m3) return { season: null, episode: parseInt(m3[1]) };
    
    // 4. 末尾分隔符+数字: -01, _01, .01
    const m4 = stem.match(/[-_.](\d{1,3})$/);
    if (m4) return { season: null, episode: parseInt(m4[1]) };
    
    // 5. 末尾空格+数字: "name 01" 或 "name01"
    const m5 = stem.match(/[\s\-_](\d{1,3})$/);
    if (m5) return { season: null, episode: parseInt(m5[1]) };
    
    // 6. 纯数字文件名
    if (/^\d{1,3}$/.test(stem.trim())) {
        return { season: null, episode: parseInt(stem) };
    }

    return { season: null, episode: null };
}

/**
 * 从文件名中提取质量标签
 * 
 * @param filename - 文件名
 * @returns 质量标签字符串，如 "4K", "1080p"
 * 
 * @example
 * extractQualityTags("movie.2160p.mkv") // "4K"
 * extractQualityTags("movie.1080p.mp4") // "1080p"
 * extractQualityTags("movie.mp4") // ""
 */
export function extractQualityTags(filename: string): string {
    const tags: string[] = [];
    const lower = filename.toLowerCase();
    
    if (lower.includes("4k") || lower.includes("2160p")) tags.push("4K");
    else if (lower.includes("1080p")) tags.push("1080p");
    else if (lower.includes("720p")) tags.push("720p");
    
    return tags.join(" - ");
}

/**
 * 从文本中解析季号
 * 
 * 支持多种格式:
 * - 英文: S01, S1, Season 1
 * - 中文: 第1季, 第一季, 第十季
 * - 特殊: 剧名1(2004), 剧名 2 (2006)
 * 
 * 中文数字映射: 一→1, 二→2, ..., 十→10, 十一→11, ...
 * 
 * @param text - 文件夹名或季信息
 * @returns 季号，无法识别返回null
 * 
 * @example
 * parseSeasonFromText("S01") // 1
 * parseSeasonFromText("Season 2") // 2
 * parseSeasonFromText("第三季") // 3
 * parseSeasonFromText("权力的游戏2 (2012)") // 2
 */
export function parseSeasonFromText(text: string): number | null {
    // S01, S1
    const m1 = text.match(/^S(\d{1,2})$/i);
    if (m1) return parseInt(m1[1]);
    
    // Season 1, Season1
    const m2 = text.match(/Season\s*(\d+)/i);
    if (m2) return parseInt(m2[1]);
    
    // 第1季, 第一季
    const m3 = text.match(/第\s*(\d+)\s*[季部]/);
    if (m3) return parseInt(m3[1]);
    
    // 中文数字: 第一季 ~ 第十季
    const cnMap: Record<string, number> = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
    };
    const m4 = text.match(/第([一二三四五六七八九十]+)[季部]/);
    if (m4) {
        const cn = m4[1];
        if (cn === '十') return 10;
        if (cn.length === 1) return cnMap[cn] || null;
        // 十一 ~ 十九
        if (cn.startsWith('十') && cn.length === 2) {
            return 10 + (cnMap[cn[1]] || 0);
        }
    }
    
    // 包含 S01 的其他格式
    const m5 = text.match(/S(\d{1,2})(?:\D|$)/i);
    if (m5) return parseInt(m5[1]);
    
    // 剧名1（2004）、剧名2（2006）这种格式 - 提取剧名后面的数字
    // 匹配: 中文/英文名 + 数字 + 可选的（年份）
    const m6 = text.match(/[\u4e00-\u9fa5a-zA-Z]+(\d{1,2})(?:\s*[\(（]\d{4}[\)）])?$/);
    if (m6) return parseInt(m6[1]);
    
    // 剧名 1、剧名 2 (带空格)
    const m7 = text.match(/\s(\d{1,2})(?:\s*[\(（]\d{4}[\)）])?$/);
    if (m7) return parseInt(m7[1]);
    
    return null;
}
