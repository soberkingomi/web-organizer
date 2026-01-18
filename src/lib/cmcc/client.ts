import { createHash } from 'crypto';

export interface CmccConfig {
  authorization: string;
  cookie: string;
  account_encrypt?: string;
  tmdb_key?: string;
  headers?: Record<string, string>; // Extra headers from config
}

export interface DirEntry {
  name: string;
  is_dir: boolean;
  file_id: string;
  parent_file_id: string;
  size: number;
  updated_at: string;
}

export class CmccClient {
  private config: CmccConfig;
  private account: string = "";
  private baseUrl: string = "https://personal-kd-njs.yun.139.com";

  constructor(config: CmccConfig) {
    this.config = config;
    this.initAccount();
  }

  private initAccount() {
    let acEnc = this.config.account_encrypt;
    const cookie = this.config.cookie || "";

    if (!acEnc && cookie.includes("ORCHES-I-ACCOUNT-ENCRYPT")) {
        const match = cookie.match(/ORCHES-I-ACCOUNT-ENCRYPT=([^;]+)/);
        if (match) acEnc = match[1];
    }

    if (acEnc) {
      try {
        if (acEnc.includes("%")) acEnc = decodeURIComponent(acEnc);
        this.account = Buffer.from(acEnc, 'base64').toString('utf-8');
      } catch (e) {
        console.error("Failed to decode account info", e);
      }
    }
  }

  private getSign(timeStr: string, randomStr: string, signPayload?: any): string {
    let r = "";
    if (signPayload) {
      // JSON stringify with separators (',', ':') to match Python's separators=(',', ':')
      // Note: JSON.stringify usually does this by default (no spaces) but we need to ensure it.
      const sJson = JSON.stringify(signPayload);
      
      // Javascript's encodeURIComponent is slightly different from Python's urllib.parse.quote
      // We need to match Python's safe chars: "-_.!~*'()"
      // encodeURIComponent escapes '!' and '*' and '(', ')' but not usually needed for them ?
      // Python quote default safe is '/'
      // In the script: quote(s_json, safe="-_.!~*'()")
      // Javascript encodeURIComponent escapes everything except: A-Z a-z 0-9 - _ . ! ~ * ' ( )
      // So it is actually matching!
      
      const rEncoded = encodeURIComponent(sJson)
          .replace(/%20/g, '+'); // Python quote might handle space differently but JSON won't have it generally

      // However, we need to replicate: r_sorted = "".join(sorted(list(r_encoded)))
      const rSorted = rEncoded.split('').sort().join('');
      r = rSorted;
    }

    const rB64 = Buffer.from(r, 'utf-8').toString('base64');
    const d = createHash('md5').update(rB64, 'utf-8').digest('hex');
    const fRaw = `${timeStr}:${randomStr}`;
    const f = createHash('md5').update(fRaw, 'utf-8').digest('hex');
    
    return createHash('md5').update(d + f, 'utf-8').digest('hex').toUpperCase();
  }

  private getCommonAccountInfo() {
      return { account: this.account, accountType: 1 };
  }

  async post(path: string, payload: any, signPayload?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    const now = new Date();
    // Format YYYY-MM-DD HH:MM:SS
    const timeStr = now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    
    // Random string 16 chars
    const randomStr = Array(16).fill(0).map(() => Math.random().toString(36)[2]).join('').substring(0, 16); // Simple random

    const sign = this.getSign(timeStr, randomStr, signPayload);
    const mcloudSign = `${timeStr},${randomStr},${sign}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json;charset=UTF-8",
      "Authorization": this.config.authorization,
      "Cookie": this.config.cookie,
      "Mcloud-Sign": mcloudSign,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36", // Matched typical UA or from config? Python usually doesn't send specific one unless defined.
      // Wait, Python script uses: 
      // requests.post(..., headers=headers)
      // Headers in Python:
      // "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" (from Python code if hardcoded, let's check view_file)
      "Accept": "application/json, text/plain, */*",
      ...(this.config.headers || {}) // Merge extra headers like 'x-yun-client-info'
    };

    console.log(`[REQ] POST ${path}`);
    console.log(`[REQ] SignPayload:`, JSON.stringify(signPayload));
    console.log(`[REQ] Mcloud-Sign: ${mcloudSign}`);
    
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    console.log(`[RESP] Status: ${res.status}`);
    
    if (!res.ok) {
       const txt = await res.text();
       console.error(`[RESP] Error Body: ${txt}`);
       throw new Error(`Request failed: ${res.status} ${res.statusText} - ${txt}`);
    }

    const json = await res.json();
    if (json.code !== "0000") {
        console.error(`[RESP] API Error: ${JSON.stringify(json)}`);
    }
    return json;
  }

  async listDir(fileId: string): Promise<DirEntry[]> {
    let cursor: string | null = null;
    const allItems: DirEntry[] = [];

    for (let i = 0; i < 100; i++) {
        const payload = {
          pageInfo: { pageSize: 100, pageCursor: cursor },
          orderBy: "updated_at",
          orderDirection: "DESC",
          parentFileId: fileId,
          imageThumbnailStyleList: ["Small", "Large"]
        };

        const signPayload = {
            commonAccountInfo: this.getCommonAccountInfo(),
            catalogID: fileId,
            catalogSortType: 0,
            contentSortType: 0,
            endNumber: 100,
            filterType: 0,
            sortDirection: 1,
            startNumber: (cursor ? 1 : 1) // Logic in python was: 1 if cursor is None else cursor. BUT wait.
            // Python: "startNumber": 1 if cursor is None else cursor
            // Actually API likely expects the cursor string if present, but the key is startNumber?
            // Let's re-read python: `sign_payload["startNumber"] = 1 if cursor is None else cursor`
            // If cursor is a string, startNumber becomes a string? weird but ok.
        };
        // Fix TS type for startNumber if needed
        (signPayload as any).startNumber = cursor || 1;

        const data = await this.post("/hcy/file/list", payload, signPayload);
        if (data.code !== "0000") {
            console.error("List failed", data);
            break;
        }

        const d = data.data || {};
        const items = d.items || d.list || d.result || [];
        
        for (const it of items) {
           const rawType = it.type;
           const isDir = (String(rawType) === "1") || (rawType === "folder");
           
           allItems.push({
               name: it.name,
               is_dir: isDir,
               file_id: it.fileId,
               parent_file_id: it.parentFileId,
               updated_at: it.updateTime || "",
               size: Number(it.size || 0)
           });
        }

        const newCursor = d.pageCursor || d.nextPageCursor;
        if (!newCursor || newCursor === cursor) break;
        cursor = newCursor;
    }

    return allItems;
  }


  async rename(fileId: string, newName: string) {
      const payload = { fileId, name: newName, description: "" };
      const signPayload = {
          commonAccountInfo: this.getCommonAccountInfo(),
          contentID: fileId,
          contentName: newName
      };
      
      const res = await this.post("/hcy/file/update", payload, signPayload);
      if (res.code !== "0000") throw new Error(`Rename failed: ${JSON.stringify(res)}`);
  }

  async mkdir(parentId: string, name: string): Promise<string> {
      // Check existing first
      const existing = await this.listDir(parentId);
      const match = existing.find(e => e.is_dir && e.name === name);
      if (match) return match.file_id;

      const payload = {
          parentFileId: parentId,
          name: name,
          description: "",
          type: "folder",
          fileRenameMode: "force_rename"
      };
      // Create usually doesn't require complex sign payload or just empty/null
      const res = await this.post("/hcy/file/create", payload, null);
      if (res.code === "0000") {
          return res.data?.fileId;
      }
      throw new Error(`Mkdir failed: ${JSON.stringify(res)}`);
  }
  
  async waitForTask(taskId: string) {
      for(let i=0; i<30; i++) {
          const res = await this.post("/hcy/task/get", {taskId}, null);
          if (res.code === "0000") {
              const info = res.data?.taskInfo || {};
              const status = String(info.status);
              if (status === "1" || status === "Succeed" || String(info.process) === "100") return;
              if (status === "2" || status === "Failed") throw new Error(`Task failed: ${JSON.stringify(info)}`);
          }
           await new Promise(r => setTimeout(r, 1000));
      }
  }

  async move(fileIds: string[], toParentId: string) {
      if (!fileIds.length) return;
      const payload = { fileIds, toParentFileId: toParentId };
      const res = await this.post("/hcy/file/batchMove", payload, null);
      if (res.code === "0000") {
          const taskId = res.data?.taskId;
          if (taskId) await this.waitForTask(taskId);
          return;
      }
      throw new Error(`Move failed: ${JSON.stringify(res)}`);
  }

  async remove(fileIds: string[]) {
      if (!fileIds.length) return;
      const payload = { fileIds };
      const res = await this.post("/hcy/recyclebin/batchTrash", payload, null);
      if (res.code === "0000") {
          const taskId = res.data?.taskId;
          if (taskId) await this.waitForTask(taskId);
          return;
      }
      console.warn(`Remove failed: ${JSON.stringify(res)}`);
  }
}
