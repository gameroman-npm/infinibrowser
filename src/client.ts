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
  readonly API_URL: string;
  readonly path: string;
  readonly params?: Params;
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

function mergeRequests(...requests: (RequestInit | undefined)[]): RequestInit {
  let mergedResult: RequestInit = {};
  const mergedHeaders = new Headers();
  for (const request of requests) {
    if (!request) continue;
    mergedResult = { ...mergedResult, ...request };
    new Headers(request.headers).forEach((value, key) => {
      mergedHeaders.set(key, value);
    });
  }
  mergedResult.headers = mergedHeaders;
  return mergedResult;
}

interface InfinibrowserConfig<TApiUrl extends string, TTimeOut extends number> {
  readonly API_URL: TApiUrl;
  readonly timeout: TTimeOut;
  readonly request?: Readonly<RequestInit>;
}

export class Infinibrowser<TApiUrl extends string, TTimeOut extends number> {
  public readonly $config: InfinibrowserConfig<TApiUrl, TTimeOut>;

  constructor(config: InfinibrowserConfig<TApiUrl, TTimeOut>) {
    this.$config = config;
  }

  $refined<TApiUrl extends string, TTimeOut extends number>(
    config: InfinibrowserConfig<TApiUrl, TTimeOut>,
  ): Infinibrowser<TApiUrl, TTimeOut> {
    return new Infinibrowser({ ...this.$config, ...config });
  }

  async #fetchWithTimeout<T>(url: URL, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.$config.timeout);

    try {
      const requestInit = mergeRequests(this.$config.request, init, {
        signal: controller.signal,
        headers: { "Accept-Encoding": "gzip, deflate, identity" },
      });
      const request = new Request(url, requestInit);
      const response = await fetch(request);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }
      const text = await response.text();
      const data: T = JSON.parse(text);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async #get<T>(options: {
    readonly path: string;
    readonly params?: Params;
  }): Promise<T> {
    const url = buildUrl({ API_URL: this.$config.API_URL, ...options });
    return this.#fetchWithTimeout<T>(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  }

  async #post<T>(options: {
    readonly path: string;
    readonly params?: Params;
    readonly payload?: Record<string, unknown>;
  }): Promise<T> {
    const url = buildUrl({ API_URL: this.$config.API_URL, ...options });
    return this.#fetchWithTimeout<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.payload ?? {}),
    });
  }

  async getItem(id: string) {
    return this.#get<ItemDataType>({ path: "/item", params: { id } });
  }

  async getRecipes(id: string, { offset = 0 }: { offset?: number } = {}) {
    return this.#get<RecipesDataType>({
      path: "/recipes",
      params: { id, offset },
    });
  }

  async getUses(id: string, { offset = 0 }: { offset?: number } = {}) {
    return this.#get<UsesDataType>({ path: "/uses", params: { id, offset } });
  }

  async getLineage(id: string) {
    return this.#get<LineageDataType>({ path: "/recipe", params: { id } });
  }

  async getCustomLineage(id: string) {
    return this.#get<CustomLineageDataType>({
      path: "/recipe/custom",
      params: { id },
    });
  }

  async optimizeLineage(id: string) {
    return this.#post<{
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

    return this.#post<{ readonly id: string }>({ path, payload });
  }
}

export const API_URL = "https://infinibrowser.wiki/api";

export const DEFAULT_OPTIONS = { API_URL, timeout: 1000 } as const;

export const ib = new Infinibrowser(DEFAULT_OPTIONS);
