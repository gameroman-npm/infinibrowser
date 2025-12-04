import type {
  ItemDataType,
  RecipesDataType,
  UsesDataType,
  LineageDataType,
  CustomLineageDataType,
  ShareLineageType,
} from "./types";

type Params = Record<string, string | number | boolean | null | undefined>;

const buildUrl = (options: {
  API_URL: string;
  path: string;
  params?: Params;
}): URL => {
  const url = new URL(`${options.API_URL}${options.path}`);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return url;
};

export class Infinibrowser<TApiUrl extends string, TTimeOut extends number> {
  public readonly API_URL: TApiUrl;
  private readonly timeout: TTimeOut;

  constructor(config: {
    readonly API_URL: TApiUrl;
    readonly timeout: TTimeOut;
  }) {
    this.API_URL = config.API_URL;
    this.timeout = config.timeout;
  }

  private async _fetchWithTimeout<T>(
    input: RequestInfo | URL,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(id);
    }
  }

  private async _get<T>(options: { path: string; params?: Params }) {
    const url = buildUrl({ API_URL: this.API_URL, ...options });
    return this._fetchWithTimeout<T>(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  }

  private async _post<T>(options: {
    path: string;
    params?: Params;
    payload?: Record<string, unknown>;
  }) {
    const url = buildUrl({ API_URL: this.API_URL, ...options });
    return this._fetchWithTimeout<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.payload ?? {}),
    });
  }

  async getItem(id: string) {
    return this._get<ItemDataType>({ path: "/item", params: { id } });
  }

  async getRecipes(id: string, { offset = 0 }: { offset?: number } = {}) {
    return this._get<RecipesDataType>({
      path: "/recipes",
      params: { id, offset },
    });
  }

  async getUses(id: string, { offset = 0 }: { offset?: number } = {}) {
    return this._get<UsesDataType>({ path: "/uses", params: { id, offset } });
  }

  async getLineage(id: string) {
    return this._get<LineageDataType>({ path: "/recipe", params: { id } });
  }

  async getCustomLineage(id: string) {
    return this._get<CustomLineageDataType>({
      path: "/recipe/custom",
      params: { id },
    });
  }

  async optimizeLineage(id: string) {
    return this._post<{
      readonly id: string;
      readonly before: number;
      readonly after: number;
    }>({
      path: "/optimize-lineage",
      params: { id },
    });
  }

  async shareLineage(steps: ShareLineageType) {
    const path = "/analytics/share";

    const lastStep = steps.at(-1);
    if (!lastStep) throw new Error("Lineage must not be empty");

    const resultElement = lastStep[2];
    const payload = { id: resultElement.id, emoji: resultElement.emoji, steps };

    return this._post<{ readonly id: string }>({ path, payload });
  }
}

export const API_URL = "https://infinibrowser.wiki/api";

export const DEFAULT_OPTIONS = { API_URL, timeout: 1000 } as const;

export const ib = new Infinibrowser(DEFAULT_OPTIONS);
