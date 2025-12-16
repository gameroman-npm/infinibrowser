import type {
  ItemDataType,
  RecipesDataType,
  UsesDataType,
  LineageDataType,
  CustomLineageDataType,
  ShareLineageType,
  UknownElement,
  InvalidElementId,
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

type FetchResponseError = Readonly<
  | { ok: false; error_code: "SYNTAX_ERROR"; error: SyntaxError }
  | { ok: false; error_code: "TIMEOUT"; error: DOMException }
  | { ok: false; error_code: "UNKNOWN_ERROR"; error: unknown }
>;

type FetchResponse<T, E = undefined> = Promise<
  | Readonly<
      | { ok: true; data: T; response: Response }
      | { ok: false; error_code: "NOT_OK"; data: E; response: Response }
    >
  | FetchResponseError
>;

function handleError(error: unknown): FetchResponseError {
  if (error instanceof SyntaxError) {
    return { ok: false, error_code: "SYNTAX_ERROR", error } as const;
  }
  if (error instanceof DOMException) {
    if (error.name === "AbortError") {
      return { ok: false, error_code: "TIMEOUT", error } as const;
    }
    return { ok: false, error_code: "UNKNOWN_ERROR", error } as const;
  }
  return { ok: false, error_code: "UNKNOWN_ERROR", error } as const;
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

  async #fetchWithTimeout<T, E = undefined>(
    url: URL,
    init: RequestInit = {},
  ): FetchResponse<T, E> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.$config.timeout);

    try {
      const requestInit = mergeRequests(this.$config.request, init, {
        signal: controller.signal,
        headers: { "Accept-Encoding": "gzip, deflate, identity" },
      });
      const request = new Request(url, requestInit);
      const response = await fetch(request);
      const ok = response.ok;
      if (!ok) {
        const text = await response.clone().text();
        const data: E = JSON.parse(text);
        return { ok, error_code: "NOT_OK", response, data } as const;
      }
      const text = await response.clone().text();
      const data: T = JSON.parse(text);
      return { ok, data, response } as const;
    } catch (error) {
      return handleError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async #get<T, E = unknown>(options: {
    readonly path: string;
    readonly params?: Params;
  }): FetchResponse<T, E> {
    const url = buildUrl({ API_URL: this.$config.API_URL, ...options });
    return this.#fetchWithTimeout<T, E>(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  }

  async #post<T, E = unknown>(options: {
    readonly path: string;
    readonly params?: Params;
    readonly payload?: Record<string, unknown>;
  }): FetchResponse<T, E> {
    const url = buildUrl({ API_URL: this.$config.API_URL, ...options });
    return this.#fetchWithTimeout<T, E>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.payload ?? {}),
    });
  }

  async getItem(id: string) {
    return this.#get<ItemDataType, UknownElement>({
      path: "/item",
      params: { id },
    });
  }

  async getRecipes(id: string, { offset = 0 }: { offset?: number } = {}) {
    return this.#get<RecipesDataType, UknownElement>({
      path: "/recipes",
      params: { id, offset },
    });
  }

  async getUses(id: string, { offset = 0 }: { offset?: number } = {}) {
    return this.#get<UsesDataType, UknownElement>({
      path: "/uses",
      params: { id, offset },
    });
  }

  async getLineage(id: string) {
    return this.#get<LineageDataType, UknownElement>({
      path: "/recipe",
      params: { id },
    });
  }

  async getCustomLineage(id: string) {
    return this.#get<CustomLineageDataType, InvalidElementId>({
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
