
// Constants
export const VIDEO_EXTS = new Set([".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".ts", ".m2ts", ".webm", ".rmvb", ".iso"]);
export const SUB_EXTS = new Set([".srt", ".ass", ".ssa", ".vtt", ".sub", ".idx", ".sup"]);

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
    /(电影|制片厂)/g
];

// Utility Functions

export function normalizeSpaces(s: string): string {
    if (!s) return "";
    return s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

export function toHalfWidth(s: string): string {
    if (!s) return "";
    return s.split('').map(char => {
        const code = char.charCodeAt(0);
        if (code === 0x3000) return ' ';
        if (code >= 0xFF01 && code <= 0xFF5E) return String.fromCharCode(code - 0xFEE0);
        return char;
    }).join('');
}

export function cleanSeriesQuery(text: string): string {
    let t = toHalfWidth(text);
    
    // Remove "Season" info
    t = t.replace(/(S\d{1,2}(?:-S\d{1,2})?|Season\s*\d+|第?\s*\d+(?:-\d+)?\s*[季部])/gi, " ");
    
    // Remove quality tags
    t = t.replace(/(1080[pP]|2160[pP]|4[kK]|8[kK]|HDR|DV|WEB-DL|H\d{3}|AAC|DDP)/gi, " ");
    
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


export function extractMovieInfo(rawName: string): { title: string, year: number | null } {
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

export function parseEpisodeFromName(name: string): { season: number | null, episode: number | null } {
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
    
    // Just digits
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
