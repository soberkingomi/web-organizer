// Constants
export const VIDEO_EXTS = new Set([
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".m4v",
  ".ts",
  ".m2ts",
  ".webm",
  ".rmvb",
  ".iso",
]);
export const SUB_EXTS = new Set([
  ".srt",
  ".ass",
  ".ssa",
  ".vtt",
  ".sub",
  ".idx",
  ".sup",
]);

// 特殊目录名集合（杂项、元数据目录）
export const MISC_DIR_NAMES = new Set([
  "@eadir",
  "__macosx",
  ".ds_store",
  "sample",
  "samples",
  "screens",
  "screen",
  "screenshots",
  "extras",
  "extra",
  "bonus",
  "bts",
  "poster",
  "posters",
  "fanart",
  "thumb",
  "thumbs",
  "artwork",
  "cd1",
  "cd2",
  "subs",
  "sub",
  "subtitle",
  "subtitles",
  "字幕",
  "字幕组",
]);

// 垃圾文件名标记
export const JUNK_MARKERS = [
  "www.",
  ".com",
  ".net",
  ".org",
  "dygm",
  "dygod",
  "ygdy8",
  "piaohua",
  "迅雷",
  "下载",
  "资源",
  "首发",
  ".pdf",
  ".txt",
  "免费",
  "搜索",
];

const SXXEYY_RE = /S(\d{1,2})\s*E(\d{1,3})/i;
const EP_NUM_RE = /\b(?:EP|E)(\d{1,3})\b/i;
const YEAR_REGEX = /(?:^|[\.\s\(\[])(19\d{2}|20\d{2})(?:$|[\.\s\)\]])/;

const MOVIE_NOISE_PATTERNS = [
  /\b(1080[pP]|2160[pP]|720[pP]|4[kK]|8[kK])\b/gi,
  /\b(BluRay|REMUX|WEB-?DL|WEBRip|HDTV|DVDRip|BDRip|UHD)\b/gi,
  /\b(H\.?264|H\.?265|x264|x265|HEVC|AVC|DDP|AAC|AC3|DTS-HD|TrueHD|Atmos|HDR|DV|DoVi|10bit|10-bit)\b/gi,
  /\b(Repack|Proper|Limited|Complete|Uncut|Extended|Director's Cut|DC)\b/gi,
  /(\[.*?\]|\(.*?\)|【.*?】|〔.*?〕)/g,
  /(\d+(?:-\d+)?部|合集|系列|Collection|Trilogy|Saga|动漫)/g,
  /(电影|制片厂)/g,
];

// Utility Functions

export function normalizeSpaces(s: string): string {
  if (!s) return "";
  return s
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toHalfWidth(s: string): string {
  if (!s) return "";
  return s
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code === 0x3000) return " ";
      if (code >= 0xff01 && code <= 0xff5e)
        return String.fromCharCode(code - 0xfee0);
      return char;
    })
    .join("");
}

export function cleanSeriesQuery(text: string): string {
  let t = toHalfWidth(text);

  // Remove "Season" info
  t = t.replace(
    /(S\d{1,2}(?:-S\d{1,2})?|Season\s*\d+|第?\s*\d+(?:-\d+)?\s*[季部])/gi,
    " ",
  );

  // Remove quality tags
  t = t.replace(
    /(1080[pP]|2160[pP]|4[kK]|8[kK]|HDR|DV|WEB-DL|H\d{3}|AAC|DDP)/gi,
    " ",
  );

  // Remove brackets
  t = t.replace(/(\[.*?\]|\(.*?\)|【.*?】)/g, " ");

  t = t.replace(/\./g, " ");
  return normalizeSpaces(t);
}

export function cleanMovieNoise(text: string): string {
  let t = text;
  for (const pat of MOVIE_NOISE_PATTERNS) {
    t = t.replace(pat, " ");
  }
  return t.replace(/\./g, " ").trim();
}

export function extractMovieInfo(rawName: string): {
  title: string;
  year: number | null;
} {
  const t = toHalfWidth(rawName);
  const mYear = t.match(YEAR_REGEX);

  let title = "";
  let year = null;

  if (mYear && mYear[1]) {
    year = parseInt(mYear[1], 10);
    const idx = t.indexOf(mYear[0]); // This is rough, regex match index is better
    // Use matchAll or exec to get index
    const match = YEAR_REGEX.exec(t);
    if (match) {
      title = cleanMovieNoise(t.substring(0, match.index));
    }
  } else {
    title = cleanMovieNoise(t);
  }

  return { title: normalizeSpaces(title), year };
}

export function parseEpisodeFromName(
  name: string,
  inSeasonFolder: boolean = false
): {
  season: number | null;
  episode: number | null;
} {
  const stem = name.replace(/\.[^/.]+$/, ""); // 移除扩展名
  
  // === 在季文件夹内的简化逻辑 ===
  if (inSeasonFolder) {
    // 1. SxxEyy 格式（保留，有些文件可能带季信息）
    const mSE = stem.match(/S(\d{1,2})\s*E(\d{1,3})/i);
    if (mSE) return { season: parseInt(mSE[1]), episode: parseInt(mSE[2]) };
    
    // 2. EPxx 格式
    const mEP = stem.match(EP_NUM_RE);
    if (mEP) return { season: null, episode: parseInt(mEP[1]) };
    
    // 3. 第x集/话/回
    const mChinese = stem.match(/第\s*(\d{1,4})\s*[集话回]/);
    if (mChinese) return { season: null, episode: parseInt(mChinese[1]) };
    
    // 4. 兜底：提取文件名中的第一个数字（1-3位，避免误匹配年份/分辨率）
    const anyNum = stem.match(/(\d{1,3})/);
    if (anyNum) return { season: null, episode: parseInt(anyNum[1]) };
    
    return { season: null, episode: null };
  }
  
  // === 根目录/未知上下文的完整逻辑 ===
  
  // 1. SxxEyy 格式（优先）
  const mSE = stem.match(/S(\d{1,2})\s*E(\d{1,3})/i);
  if (mSE) return { season: parseInt(mSE[1]), episode: parseInt(mSE[2]) };
  
  // 2. 第x集/话/回（视为第1季）
  const mChinese = stem.match(/第\s*(\d{1,4})\s*[集话回]/);
  if (mChinese) return { season: null, episode: parseInt(mChinese[1]) };
  
  // 3. EPxx 格式
  const mEP = stem.match(EP_NUM_RE);
  if (mEP) return { season: null, episode: parseInt(mEP[1]) };
  
  // 4. [前缀] 数字
  const mHead = stem.match(/^(?:[[\【(].*?[\]】)]\s*)*(\d{1,3})(?=\s)/);
  if (mHead) return { season: null, episode: parseInt(mHead[1]) };
  
  // 5. -01, _01 等
  const mSep = stem.match(/[-_.](\d{1,3})$/);
  if (mSep) return { season: null, episode: parseInt(mSep[1]) };
  
  // 6. 空格+数字
  const mSpace = stem.match(/\s(\d{1,3})$/);
  if (mSpace) return { season: null, episode: parseInt(mSpace[1]) };
  
  // 7. 纯数字（最后尝试）
  const pureNum = stem.trim();
  if (/^\d{1,3}$/.test(pureNum)) {
    return { season: null, episode: parseInt(pureNum) };
  }
  
  return { season: null, episode: null };
}

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
 * 支持: S01, Season 1, 第1季, 第一季, 剧名1（2004）等格式
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
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const m4 = text.match(/第([一二三四五六七八九十]+)[季部]/);
  if (m4) {
    const cn = m4[1];
    if (cn === "十") return 10;
    if (cn.length === 1) return cnMap[cn] || null;
    // 十一 ~ 十九
    if (cn.startsWith("十") && cn.length === 2) {
      return 10 + (cnMap[cn[1]] || 0);
    }
  }

  // 包含 S01 的其他格式
  const m5 = text.match(/S(\d{1,2})(?:\D|$)/i);
  if (m5) return parseInt(m5[1]);

  // 剧名1（2004）、剧名2（2006）这种格式 - 提取剧名后面的数字
  // 匹配: 中文/英文名 + 数字 + 可选的（年份）
  const m6 = text.match(
    /[\u4e00-\u9fa5a-zA-Z]+(\d{1,2})(?:\s*[\(（]\d{4}[\)）])?$/,
  );
  if (m6) return parseInt(m6[1]);

  // 剧名 1、剧名 2 (带空格)
  const m7 = text.match(/\s(\d{1,2})(?:\s*[\(（]\d{4}[\)）])?$/);
  if (m7) return parseInt(m7[1]);

  return null;
}
