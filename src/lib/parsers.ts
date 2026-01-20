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

export function parseEpisodeFromName(name: string): {
  season: number | null;
  episode: number | null;
} {
  const stem = name.replace(/\.[^/.]+$/, ""); // remove extension

  // SxxEyy
  const m1 = stem.match(/S(\d{1,2})\s*E(\d{1,3})/i);
  if (m1) return { season: parseInt(m1[1]), episode: parseInt(m1[2]) };

  // Chinese "第x集"
  const m2 = stem.match(/第\s*(\d{1,4})\s*[集话回]/);
  if (m2) return { season: null, episode: parseInt(m2[1]) };

  // EPxx
  const m3 = stem.match(EP_NUM_RE);
  if (m3) return { season: null, episode: parseInt(m3[1]) };

  // [Prefix] 01 Title (处理类似 "【公众号：阿白随手盘】 03 大小药丸" 的格式)
  // 匹配开头（忽略括号内容）后的 1-3 位数字，且数字后必须跟空格
  // 使用 \d{1,3} 可以避免误匹配 4 位年份（如 2024）
  const mHead = stem.match(/^(?:[[【(].*?[\]】)]\s*)*(\d{1,3})(?=\s)/);
  if (mHead) return { season: null, episode: parseInt(mHead[1]) };

  // -01, _01, .01, 【xx】name-01 等格式
  const m4 = stem.match(/[-_.](\d{1,3})$/);
  if (m4) return { season: null, episode: parseInt(m4[1]) };

  // 文件名末尾的数字，如 "xxx 01" 或 "xxx01"
  const m5 = stem.match(/[\s\-_](\d{1,3})$/);
  if (m5) return { season: null, episode: parseInt(m5[1]) };

  // Just digits (纯数字文件名)
  if (/^\d{1,3}$/.test(stem.trim())) {
    return { season: null, episode: parseInt(stem) };
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
