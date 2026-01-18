export class TMDBClient {
  private apiKey: string;
  private language: string;
  private baseUrl = "https://api.themoviedb.org/3";

  constructor(apiKey: string, language: string = "zh-CN") {
    this.apiKey = apiKey;
    this.language = language;
  }

  private async get(path: string, params: Record<string, any>) {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.append("api_key", this.apiKey);
    url.searchParams.append("language", this.language);
    
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
            url.searchParams.append(k, String(v));
        }
    }

    try {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`TMDB Error: ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error("TMDB Request Failed", e);
      return {};
    }
  }

  async searchTv(query: string) {
    const data = await this.get("/search/tv", { query });
    return data.results || [];
  }
  
  async searchMovie(query: string, year?: number) {
      const params: Record<string, any> = { query };
      if (year) params.year = year;
      const data = await this.get("/search/movie", params);
      return data.results || [];
  }

  async tvDetails(tvId: number) {
    return await this.get(`/tv/${tvId}`, {});
  }

  async movieDetails(movieId: number) {
    return await this.get(`/movie/${movieId}`, { append_to_response: "alternative_titles" });
  }
}
