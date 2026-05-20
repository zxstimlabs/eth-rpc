/**
 * Uniswap Trading API client
 * --------------------------
 * Thin, typed wrapper over the three Trading API endpoints documented at
 * https://api-docs.uniswap.org. The Trading API is a single multi-chain
 * host (chain is passed as `chainId` / `tokenInChainId` in the request
 * body, not in the URL) covering:
 *
 *   POST /check_approval   — produce an ERC-20 approval tx when needed
 *   POST /quote            — routed quote (CLASSIC AMM or UniswapX order)
 *   POST /swap             — turn a quote into a broadcastable transaction
 *
 * Typical flow:
 *   const { approval } = await client.checkApproval({ ... });
 *   if (approval) await wallet.sendTransaction(approval);
 *   const quote = await client.getQuote({ ... });
 *   // (optionally) sign quote.permitData → signature
 *   const { swap } = await client.getSwap({ quote, signature });
 *   await wallet.sendTransaction(swap);
 *
 * Native-token convention: Uniswap uses the zero address for native ETH /
 * BNB / etc. — same as the Uniswap frontend convention — so no sentinel
 * translation is needed (unlike `zerox` or `kyberswap`).
 */

// --- Constants -------------------------------------------------------------

const DEFAULT_BASE_URL = "https://trade-api.gateway.uniswap.org/v1";

/**
 * Sent as the `x-universal-router-version` header on every request. Pinned
 * to 2.0 because the Trading API's CLASSIC swap calldata targets Universal
 * Router v2. Bump deliberately — older router contracts use different
 * command encodings.
 */
const DEFAULT_UNIVERSAL_ROUTER_VERSION = "2.0";

// --- Chain identifiers -----------------------------------------------------

/**
 * Numeric chain IDs that have a deployed Universal Router v2. The union
 * covers chains listed in the Uniswap docs at the time of writing; the
 * `(number & {})` fallback keeps autocomplete while still letting callers
 * pass new chain IDs as Uniswap adds support without an SDK update.
 */
export type UniswapChainId =
  | 1 // Ethereum
  | 10 // Optimism
  | 56 // BNB Smart Chain
  | 130 // Unichain
  | 137 // Polygon
  | 143 // Monad
  | 480 // World Chain
  | 1868 // Soneium
  | 8453 // Base
  | 42161 // Arbitrum One
  | 42220 // Celo
  | 43114 // Avalanche
  | 57073 // Ink
  | 81457 // Blast
  | 7777777 // Zora
  // deno-lint-ignore ban-types
  | (number & {});

// --- Shared schemas --------------------------------------------------------

/** Direction of the swap relative to the user-supplied `amount`. */
export type UniswapSwapType = "EXACT_INPUT" | "EXACT_OUTPUT";

/**
 * High-level routing preference passed to `/quote`.
 *
 *  - `BEST_PRICE` — let the API pick across CLASSIC and UniswapX. On
 *    mainnet this usually returns DUTCH_V2/V3 (UniswapX) for non-trivial
 *    sizes; on chains without UniswapX it falls back to CLASSIC.
 *  - `FASTEST`    — prefer routes with the lowest end-to-end latency.
 *  - `CLASSIC`    — force the AMM (Universal Router) path. Use when the
 *    caller cannot sign UniswapX orders off-chain.
 *
 * Open string fallback covers any new preference Uniswap exposes without
 * an SDK bump.
 */
export type UniswapRoutingPreference =
  | "BEST_PRICE"
  | "FASTEST"
  | "CLASSIC"
  // deno-lint-ignore ban-types
  | (string & {});

/** AMM versions the caller can opt into via the `protocols` quote param. */
export type UniswapProtocol = "V2" | "V3" | "V4";

/** UniswapX auction urgency — affects how aggressively prices decay. */
export type UniswapUrgency = "normal" | "fast" /* deno-lint-ignore ban-types */ | (string & {});

/**
 * Discriminator returned on every quote response. `CLASSIC` / `WRAP` /
 * `UNWRAP` map to the AMM-shaped variant (`ClassicQuoteResponse`); the
 * `DUTCH_*` and `PRIORITY` values map to the UniswapX-shaped variant
 * (`UniswapXQuoteResponse`). Other documented routings (`DUTCH_LIMIT`,
 * `LIMIT_ORDER`, `BRIDGE`, `QUICKROUTE`) are listed for narrowing but
 * their exact response shape is not pinned in this SDK yet.
 */
export type UniswapRouting =
  | "CLASSIC"
  | "DUTCH_V2"
  | "DUTCH_V3"
  | "PRIORITY"
  | "DUTCH_LIMIT"
  | "LIMIT_ORDER"
  | "WRAP"
  | "UNWRAP"
  | "BRIDGE"
  | "QUICKROUTE"
  // deno-lint-ignore ban-types
  | (string & {});

/**
 * A broadcastable transaction returned by `/check_approval` (the `approval`
 * field) and `/swap` (the `swap` field). Pass straight to viem's
 * `sendTransaction` after converting `value` to a bigint.
 */
export interface UniswapTransaction {
  to: string;
  from: string;
  data: string;
  /** Wei amount as a decimal string. Always present; `"0"` for ERC-20-only flows. */
  value: string;
  chainId: number;
  /**
   * Recommended gas limit as a decimal string. Returned by `/swap`; absent
   * on `/check_approval` responses.
   */
  gasLimit?: string;
}

/**
 * EIP-712 typed-data payload to sign with the user's wallet. Used both for
 * Permit2 approvals on CLASSIC routes and for the order itself on UniswapX
 * routes — the surrounding routing type dictates whether the resulting
 * signature gets posted back to `/swap` alongside `permitData` (CLASSIC)
 * or alone (UniswapX). See `getSwap` for the dispatch.
 *
 * Field shapes are kept loose because the inner structure varies by
 * Permit2 vs Dutch order vs priority order. Pass the object to your
 * wallet's `signTypedData` verbatim.
 */
export interface UniswapPermitData {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  /** Some Uniswap responses use `values`; some use `message`. Both observed. */
  values?: Record<string, unknown>;
  message?: Record<string, unknown>;
  /** Optional — names the root type to sign. */
  primaryType?: string;
}

// --- Error -----------------------------------------------------------------

/**
 * Error body shape returned by the Trading API. The API consistently
 * surfaces a human-readable `detail` on 4xx/5xx; other fields vary.
 */
export interface UniswapApiError {
  /** Human-readable error message — surfaced into `UniswapError.message`. */
  detail?: string;
  /** Sometimes present — Uniswap's internal error code. */
  errorCode?: string;
  /** Field-level validation errors when applicable. */
  validationErrors?: unknown;
}

/**
 * Thrown for any non-2xx response from the Trading API. Carries HTTP
 * status, the optional upstream `errorCode`, and the parsed body so
 * callers can branch on documented error codes.
 *
 * Common statuses (per the skill docs):
 *   400 — invalid request (e.g. `permitData: null` sent; quote wrapped)
 *   401 — invalid or missing `x-api-key`
 *   404 — no route found for the requested pair
 *   429 — rate limited; back off with jitter
 *   500 — upstream error; retry with exponential backoff
 */
export class UniswapError extends Error {
  readonly status: number;
  readonly errorCode?: string;
  readonly body?: unknown;

  constructor(args: {
    message: string;
    status: number;
    errorCode?: string;
    body?: unknown;
  }) {
    super(args.message);
    this.name = "UniswapError";
    this.status = args.status;
    this.errorCode = args.errorCode;
    this.body = args.body;
  }
}

// --- Client options --------------------------------------------------------

export interface UniswapClientOptions {
  /**
   * Uniswap Trading API key. Sent as the `x-api-key` header. Register at
   * https://developers.uniswap.org/ to obtain one. Required — requests
   * without it return 401.
   */
  apiKey: string;
  /** Override the API host (e.g. for staging or a CORS proxy). */
  baseUrl?: string;
  /**
   * If set on the client, every method may omit its own `chainId` and use
   * this default. Per-call `chainId` always wins.
   */
  defaultChainId?: UniswapChainId;
  /**
   * Override the `x-universal-router-version` header. Defaults to `"2.0"`
   * — only change this if Uniswap publishes a newer Universal Router and
   * you have verified the new command encoding.
   */
  universalRouterVersion?: string;
  /**
   * If true, sends `x-permit2-disabled: true` on every request. The
   * Trading API then returns CLASSIC quotes with `permitData: null` and
   * the resulting swap calldata expects the taker to have a LEGACY
   * approval on the Universal Router (i.e. `approve(UR, amount)` on the
   * sell token) rather than going through Permit2 + EIP-712 signing.
   *
   * Default false. Set this when the caller can't sign Permit2 messages
   * — typical for server-side flows and backend services. Without this,
   * ERC20 swaps return calldata that requires a wallet signature, and
   * submitting them without one results in on-chain reverts (native
   * swaps "just work" because they don't transfer ERC20 in).
   */
  disablePermit2?: boolean;
  /** Custom fetch implementation (testing, retries, instrumentation). */
  fetch?: typeof fetch;
  /** Per-request timeout in ms. Omit to disable. */
  timeoutMs?: number;
}

export interface CallOptions {
  /** Override the chain for this single call. */
  chainId?: UniswapChainId;
  /** External AbortSignal — composes with `timeoutMs` if both are set. */
  signal?: AbortSignal;
}

// --- Client ----------------------------------------------------------------

export class UniswapClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultChainId?: UniswapChainId;
  private readonly universalRouterVersion: string;
  private readonly disablePermit2: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs?: number;

  constructor(options: UniswapClientOptions) {
    if (!options.apiKey) {
      throw new Error("UniswapClient: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.defaultChainId = options.defaultChainId;
    this.universalRouterVersion =
      options.universalRouterVersion ?? DEFAULT_UNIVERSAL_ROUTER_VERSION;
    this.disablePermit2 = options.disablePermit2 ?? false;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs;
  }

  /**
   * `POST /check_approval` — ask the API whether the taker needs to set
   * (or top up) an ERC-20 allowance on the Universal Router / Permit2
   * before a swap of `amount` units of `token` can succeed.
   *
   * Returns `{ approval: null }` when the allowance is already sufficient.
   * Otherwise `approval` is a ready-to-broadcast `approve()` transaction.
   *
   * Skip this call entirely when selling the native asset (zero address) —
   * native swaps don't require ERC-20 approvals.
   */
  async checkApproval(
    params: CheckApprovalParams,
    options: CallOptions = {}
  ): Promise<CheckApprovalResponse> {
    const chainId = params.chainId ?? this.resolveChainId(options.chainId);
    const body: CheckApprovalParams = { ...params, chainId };
    return this.request<CheckApprovalResponse>(
      "POST",
      "/check_approval",
      body,
      options.signal
    );
  }

  /**
   * `POST /quote` — get a routed quote for the requested pair. The
   * returned shape is a discriminated union on `routing`:
   *
   *  - `CLASSIC` / `WRAP` / `UNWRAP` → `ClassicQuoteResponse` (use
   *    `quote.output.amount`, sign `permitData` for Permit2 if returned).
   *  - `DUTCH_V2` / `DUTCH_V3` / `PRIORITY` → `UniswapXQuoteResponse` (use
   *    `quote.orderInfo.outputs[0].startAmount` for the best-case fill;
   *    `endAmount` is the auction floor).
   *
   * Use `isUniswapXQuote` / `getQuoteOutputAmount` to narrow safely.
   *
   * Per the API contract, `tokenInChainId` and `tokenOutChainId` go on
   * the wire as decimal strings; this SDK accepts numeric `UniswapChainId`
   * and stringifies them for you. Quotes typically expire in ~30s — refetch
   * before submitting if the user pauses to confirm.
   */
  async getQuote(
    params: QuoteParams,
    options: CallOptions = {}
  ): Promise<QuoteResponse> {
    const defaultChainId =
      params.tokenInChainId ?? this.resolveChainId(options.chainId);
    const body: Record<string, unknown> = {
      ...params,
      tokenInChainId: String(defaultChainId),
      tokenOutChainId: String(params.tokenOutChainId ?? defaultChainId),
    };
    return this.request<QuoteResponse>(
      "POST",
      "/quote",
      body,
      options.signal
    );
  }

  /**
   * `POST /swap` — turn a `/quote` response into a broadcastable
   * transaction. The API expects the quote response spread directly into
   * the request body (NOT wrapped in `{ quote: ... }`), with routing-aware
   * handling of `signature` / `permitData`:
   *
   *  - CLASSIC / WRAP / UNWRAP / unknown routings:
   *      • If `signature` is provided AND `quote.permitData` is non-null →
   *        send both. The Universal Router needs `permitData` to verify
   *        the Permit2 authorization on-chain.
   *      • Else → send neither. Sending one without the other returns a
   *        400 from the API.
   *  - DUTCH_V2 / DUTCH_V3 / PRIORITY (UniswapX):
   *      • Send only `signature`. The order itself is already encoded in
   *        `quote.quote.encodedOrder`; including `permitData` causes a
   *        schema-validation 400.
   *
   * Always strip `permitData: null` — even on CLASSIC. The API rejects
   * null. The skill notes a recurring `permitTransaction` field that
   * should also be omitted from the body; this SDK does both.
   *
   * Pass the optional `signature` (hex 0x...) from a wallet `signTypedData`
   * call over `quote.permitData`.
   */
  async getSwap(
    args: SwapRequestArgs,
    options: CallOptions = {}
  ): Promise<SwapResponse> {
    const body = buildSwapRequestBody(args);
    return this.request<SwapResponse>(
      "POST",
      "/swap",
      body,
      options.signal
    );
  }

  // --- internals -----------------------------------------------------------

  /**
   * Resolve a per-call `chainId` against `defaultChainId`. Throws if
   * neither is set — every Trading API endpoint needs to know the chain.
   */
  private resolveChainId(perCall?: UniswapChainId): UniswapChainId {
    const chainId = perCall ?? this.defaultChainId;
    if (chainId === undefined) {
      throw new Error(
        "UniswapClient: chainId must be supplied either via `defaultChainId` " +
          "in the constructor, an explicit `chainId` field on the params, or " +
          "`options.chainId` on the call"
      );
    }
    return chainId;
  }

  /**
   * Issue a request against the Trading API. All three endpoints are POST
   * + JSON, so this is intentionally narrow. Auth headers, version
   * pinning, timeout composition, and error mapping all live here.
   */
  private async request<T>(
    method: "POST",
    path: string,
    body: unknown,
    externalSignal?: AbortSignal
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
      "x-universal-router-version": this.universalRouterVersion,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.disablePermit2) {
      headers["x-permit2-disabled"] = "true";
    }

    const { signal, cancel } = composeSignals(externalSignal, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } finally {
      cancel();
    }

    const text = await response.text();
    const parsed = text.length > 0 ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      const err = (parsed as UniswapApiError | undefined) ?? {};
      throw new UniswapError({
        message:
          err.detail ??
          `Uniswap HTTP ${response.status} ${response.statusText}`,
        status: response.status,
        errorCode: err.errorCode,
        body: parsed,
      });
    }

    return parsed as T;
  }
}

// --- /check_approval -------------------------------------------------------

export interface CheckApprovalParams {
  walletAddress: string;
  /** ERC-20 contract address. Native (zero address) does not need approval. */
  token: string;
  /**
   * Amount in token base units (decimal string). The API will return an
   * approval tx only if the wallet's current allowance falls below this.
   */
  amount: string;
  /**
   * If omitted, the client's `defaultChainId` (or `options.chainId`) is
   * used. Set explicitly to call into a different chain per-request.
   */
  chainId?: UniswapChainId;
}

export interface CheckApprovalResponse {
  /**
   * Approval transaction to broadcast before the swap, or `null` when the
   * current allowance is already sufficient. `value` will be `"0"` for
   * ERC-20 approvals.
   */
  approval: UniswapTransaction | null;
}

// --- /quote ----------------------------------------------------------------

/**
 * Parameters for `getQuote`. Use `tokenInChainId` / `tokenOutChainId` for
 * cross-chain bridge quotes; otherwise leave them off and let the client
 * fill both from `defaultChainId` / `options.chainId`.
 */
export interface QuoteParams {
  /** Address that will sign / execute the trade. */
  swapper: string;
  /** Input token contract. Zero address = native. */
  tokenIn: string;
  /** Output token contract. Zero address = native. */
  tokenOut: string;
  /** Sell-chain ID. Stringified on the wire — pass a number. */
  tokenInChainId?: UniswapChainId;
  /** Buy-chain ID. Stringified on the wire. Defaults to `tokenInChainId`. */
  tokenOutChainId?: UniswapChainId;
  /** Amount in `tokenIn` units (EXACT_INPUT) or `tokenOut` units (EXACT_OUTPUT). */
  amount: string;
  type: UniswapSwapType;
  /** 0–100 percentage. Ignored when `autoSlippage` is `true`. */
  slippageTolerance?: number;
  /** Lets the API pick slippage based on volatility. Overrides `slippageTolerance`. */
  autoSlippage?: boolean;
  /** Restrict / prefer specific AMM versions on CLASSIC routes. */
  protocols?: UniswapProtocol[];
  routingPreference?: UniswapRoutingPreference;
  /** Affects UniswapX auction timing. */
  urgency?: UniswapUrgency;
  /** Unix epoch seconds. Falls back to the API's default. */
  deadline?: number;
  /** Optional recipient override (defaults to `swapper`). */
  recipient?: string;
  /**
   * Integrator fee configuration. When provided, the specified fee is
   * applied to the swap and the realized amount is surfaced on the
   * response's `portionBips` / `portionAmount` fields. The fee is always
   * taken from the output token per the Trading API contract.
   *
   * Note the asymmetry between input and output field names: requests
   * use `{ bips, recipient }`, responses use `portionBips` / `portionAmount`
   * / `portionRecipient`. The `portion*` prefix is read-side only.
   */
  integratorFees?: UniswapIntegratorFee[];
}

/**
 * One integrator fee entry on `QuoteParams.integratorFees`. Field names
 * are verified against the live API — sending `portionBips` here is
 * rejected as `"integratorFees[0].bips" is required`.
 */
export interface UniswapIntegratorFee {
  /** Fee in basis points. 10 = 0.10%. */
  bips: number;
  /** Address that receives the fee. */
  recipient: string;
}

/** Per-fill segment on a CLASSIC route. Shape kept loose — Uniswap evolves it. */
export type UniswapRouteSegment = Record<string, unknown>;

/** CLASSIC / WRAP / UNWRAP — AMM-shaped quote payload. */
export interface ClassicQuote {
  input: { token: string; amount: string };
  output: { token: string; amount: string };
  /** Effective slippage in percent. */
  slippage: number;
  /** Routing breakdown — opaque; render via Uniswap's UI primitives if needed. */
  route: UniswapRouteSegment[];
  /** Gas estimate in wei (decimal string). */
  gasFee: string;
  /**
   * USD value of `gasFee` as a decimal string. Use this for UI cost
   * display — do NOT convert `gasFee` with a hardcoded ETH price.
   */
  gasFeeUSD: string;
  /** Gas limit estimate as a decimal string. */
  gasUseEstimate: string;
}

export interface ClassicQuoteResponse {
  routing: "CLASSIC" | "WRAP" | "UNWRAP";
  quote: ClassicQuote;
  /**
   * Permit2 EIP-712 payload — present when the swap requires a Permit2
   * signature alongside the swap call. Sign it locally and pass to
   * `getSwap` together with the signature. The Universal Router needs
   * BOTH `signature` and `permitData` on-chain to verify the permit.
   *
   * `null` when no Permit2 signing is required (e.g. native ETH input,
   * wrap/unwrap).
   */
  permitData: UniswapPermitData | null;
}

/** A single output leg of a UniswapX Dutch / priority order. */
export interface UniswapXOrderOutput {
  token: string;
  /** Best-case fill amount (auction start). Use for "expected" UI. */
  startAmount: string;
  /** Floor after full auction decay. Use for "minimum received" UI. */
  endAmount: string;
  recipient: string;
}

/** Input leg of a UniswapX order — exact-in orders have start == end. */
export interface UniswapXOrderInput {
  token: string;
  startAmount: string;
  endAmount: string;
}

export interface UniswapXOrderInfo {
  reactor: string;
  swapper: string;
  nonce: string;
  /** Unix epoch seconds. */
  deadline: number;
  /** Cosigner — only populated on V2 exclusive Dutch orders. */
  cosigner?: string;
  input: UniswapXOrderInput;
  outputs: UniswapXOrderOutput[];
  chainId: number;
}

export interface UniswapXQuote {
  orderInfo: UniswapXOrderInfo;
  /** ABI-encoded order calldata. The filler system reads this directly. */
  encodedOrder: string;
  /** EIP-712 hash of the order — useful for sanity checks and analytics. */
  orderHash: string;
}

export interface UniswapXQuoteResponse {
  routing: "DUTCH_V2" | "DUTCH_V3" | "PRIORITY";
  quote: UniswapXQuote;
  /**
   * EIP-712 typed data for the order itself — sign locally. Unlike
   * CLASSIC, this is NOT submitted to `/swap`; only the resulting
   * signature is. Sending `permitData` to `/swap` for a UniswapX route
   * returns a 400 (schema mismatch).
   */
  permitData: UniswapPermitData | null;
}

/**
 * Discriminated union of every `/quote` response. Narrow via `routing`
 * before reading variant-specific fields. Forward-compat fallback covers
 * routings the SDK doesn't yet model (DUTCH_LIMIT, LIMIT_ORDER, BRIDGE,
 * QUICKROUTE).
 */
export type QuoteResponse =
  | ClassicQuoteResponse
  | UniswapXQuoteResponse
  | UnknownRoutingQuoteResponse;

/**
 * Catch-all for routings the SDK doesn't pin a schema for. `quote` and
 * `permitData` are typed loosely so callers can read fields without a
 * type assertion, but the shape isn't guaranteed.
 */
export interface UnknownRoutingQuoteResponse {
  routing: Exclude<
    UniswapRouting,
    "CLASSIC" | "WRAP" | "UNWRAP" | "DUTCH_V2" | "DUTCH_V3" | "PRIORITY"
  >;
  quote: Record<string, unknown>;
  permitData: UniswapPermitData | null;
}

/**
 * True when the quote came back as a UniswapX (Dutch / priority) order.
 * Narrows `q` to `UniswapXQuoteResponse` in the true branch.
 */
export function isUniswapXQuote(q: QuoteResponse): q is UniswapXQuoteResponse {
  return (
    q.routing === "DUTCH_V2" ||
    q.routing === "DUTCH_V3" ||
    q.routing === "PRIORITY"
  );
}

/**
 * True for CLASSIC / WRAP / UNWRAP — the AMM-shaped variants. Narrows
 * `q` to `ClassicQuoteResponse` in the true branch.
 */
export function isClassicQuote(q: QuoteResponse): q is ClassicQuoteResponse {
  return (
    q.routing === "CLASSIC" || q.routing === "WRAP" || q.routing === "UNWRAP"
  );
}

/**
 * Convenience reader for the buy-side amount, regardless of routing.
 *
 *  - CLASSIC / WRAP / UNWRAP → `quote.output.amount`.
 *  - UniswapX                → `quote.orderInfo.outputs[0].startAmount`
 *                              (the best-case fill; `endAmount` is the
 *                              auction floor).
 *
 * Throws for unknown routings or UniswapX quotes with no outputs.
 */
export function getQuoteOutputAmount(q: QuoteResponse): string {
  if (isUniswapXQuote(q)) {
    const first = q.quote.orderInfo.outputs[0];
    if (!first) throw new Error("UniswapX quote has no outputs");
    return first.startAmount;
  }
  if (isClassicQuote(q)) {
    return q.quote.output.amount;
  }
  throw new Error(`Unknown routing ${q.routing} — read output amount manually`);
}

// --- /swap -----------------------------------------------------------------

export interface SwapRequestArgs {
  /** The full response from `getQuote` — spread back into the body by the SDK. */
  quote: QuoteResponse;
  /**
   * Hex signature (`0x...`) produced by the wallet over `quote.permitData`.
   * Required for CLASSIC routes that returned a non-null `permitData`, and
   * for every UniswapX route. Omit otherwise.
   */
  signature?: string;
}

export interface SwapResponse {
  swap: UniswapTransaction;
}

/**
 * Build the `/swap` POST body from a quote response + optional signature.
 * The Trading API expects the quote response spread back, NOT wrapped in
 * `{ quote: ... }` — and `permitData` handling is routing-dependent:
 *
 *  - UniswapX (DUTCH_*, PRIORITY): submit signature only; `permitData`
 *    must be omitted.
 *  - CLASSIC / WRAP / UNWRAP / unknown: submit `signature` + `permitData`
 *    together if both are present; otherwise neither.
 *
 * Exported as `_internals.buildSwapRequestBody` for callers who want to
 * inspect the body before POSTing (e.g. for logging or a custom proxy).
 */
function buildSwapRequestBody({
  quote,
  signature,
}: SwapRequestArgs): Record<string, unknown> {
  // Strip permitData and permitTransaction from the spread — handled below.
  const {
    permitData,
    // The skill calls out this stray field — it sometimes appears on quote
    // responses and the API rejects it on the swap body.
    permitTransaction: _permitTransaction,
    ...rest
  } = quote as QuoteResponse & {
    permitTransaction?: unknown;
  };
  void _permitTransaction;

  const body: Record<string, unknown> = { ...rest };

  if (isUniswapXQuote(quote)) {
    // UniswapX: signature only — the order is already in `quote.encodedOrder`,
    // and the API's schema rejects a `permitData` field on this body.
    if (signature) body.signature = signature;
    return body;
  }

  // CLASSIC / WRAP / UNWRAP / unknown: both Permit2 fields go together, or
  // neither. Never send `permitData: null` — the API rejects it explicitly.
  if (signature && permitData && typeof permitData === "object") {
    body.signature = signature;
    body.permitData = permitData;
  }
  return body;
}

// --- helpers ---------------------------------------------------------------

/**
 * Exposed for callers that want to inspect / serialize / proxy the
 * outbound `/swap` body without invoking the client (e.g. for custom CORS
 * proxies, logging, or test fixtures).
 */
export const _internals = {
  buildSwapRequestBody,
};

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Combine an optional external AbortSignal with an optional timeout into a
 * single signal, returning a `cancel()` to clear the timeout once the
 * request settles (so we don't leak timers on success).
 */
function composeSignals(
  external: AbortSignal | undefined,
  timeoutMs: number | undefined
): { signal: AbortSignal | undefined; cancel: () => void } {
  if (!external && !timeoutMs) return { signal: undefined, cancel: () => {} };

  const controller = new AbortController();
  const onAbort = () => controller.abort((external as any)?.reason);
  external?.addEventListener("abort", onAbort, { once: true });

  const timer = timeoutMs
    ? setTimeout(
        () =>
          controller.abort(
            new Error(`Uniswap request timed out after ${timeoutMs}ms`)
          ),
        timeoutMs
      )
    : undefined;

  return {
    signal: controller.signal,
    cancel: () => {
      if (timer) clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    },
  };
}
