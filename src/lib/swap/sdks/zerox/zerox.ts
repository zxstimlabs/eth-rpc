/**
 * 0x API client
 * -------------
 * Thin, typed wrapper over the 0x API surfaces documented at
 * https://docs.0x.org. The 0x API is a single multi-chain host (chain is
 * passed as a `chainId` query parameter, not a path segment) covering:
 *
 *   /swap/allowance-holder/{price,quote}   — AllowanceHolder approval model
 *   /swap/permit2/{price,quote}            — Permit2 approval model
 *   /gasless/{price,quote,submit,status}   — sponsored / gasless swaps
 *   /sources                               — supported liquidity sources
 *   /trade-analytics/swap                  — historical trade analytics
 *
 * Endpoint methods are added incrementally — this file currently provides
 * the client, auth, error handling, and shared helpers. See the request
 * helper `request()` and the chainId-resolving helper `resolveChainId()`
 * for the contract every endpoint method should follow.
 */

// --- Constants -------------------------------------------------------------

/**
 * 0x's sentinel address for the chain's native token (ETH, BNB, ...).
 * Use this for `sellToken` or `buyToken` instead of the wrapped address
 * when you want to swap from/to the native asset directly.
 *
 * Unlike KyberSwap, 0x uses the EIP-55 mixed-case form. The API accepts
 * either casing on input, but we normalize to this canonical form so the
 * value compares equal in client-side logic.
 */
export const ZEROX_NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/**
 * The frontend convention (Uniswap-style) is to represent the native token
 * with the zero address; 0x uses the `0xEeee…EeeE` sentinel above. Anywhere
 * a caller hands us a token address, we translate the zero address to 0x's
 * sentinel transparently so the frontend doesn't have to know.
 */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function normalizeNativeAddress(address: string): string {
  return address.toLowerCase() === ZERO_ADDRESS
    ? ZEROX_NATIVE_TOKEN_ADDRESS
    : address;
}

const ZEROX_NATIVE_LOWER = ZEROX_NATIVE_TOKEN_ADDRESS.toLowerCase();

/**
 * Reverse of `normalizeNativeAddress`: rewrites 0x's native sentinel back
 * to the zero address so frontends keep seeing their preferred form.
 * Apply to every token-address field on returned response shapes when
 * wiring up endpoint methods.
 */
function denormalizeNativeAddress(address: string): string {
  return address.toLowerCase() === ZEROX_NATIVE_LOWER ? ZERO_ADDRESS : address;
}

const DEFAULT_BASE_URL = "https://api.0x.org";

/**
 * Pinned 0x API version. Sent as the `0x-version` header on every request.
 * Bump deliberately — response shapes can change between major versions.
 */
const ZEROX_API_VERSION = "v2";

// --- Chain identifiers -----------------------------------------------------

/**
 * Numeric chain IDs accepted in the `chainId` query parameter. The union
 * covers chains listed in 0x's "Supported Chains" docs at the time of
 * writing; the `(number & {})` fallback keeps autocomplete while still
 * letting callers pass new chain IDs as 0x adds support without an SDK
 * update. See https://docs.0x.org/introduction/supported-chains.
 */
export type ZeroxChainId =
  | 1 // Ethereum
  | 10 // Optimism
  | 56 // BNB Smart Chain
  | 137 // Polygon
  | 8453 // Base
  | 42161 // Arbitrum One
  | 43114 // Avalanche
  | 81457 // Blast
  | 534352 // Scroll
  | 59144 // Linea
  | 5000 // Mantle
  // deno-lint-ignore ban-types
  | (number & {});

// --- Shared schemas --------------------------------------------------------

/**
 * `wrapUnwrapMode` controls how a wrap (e.g. ETH -> WETH) or unwrap is
 * executed. `direct` calls the wrapped-native contract directly; `settler`
 * routes through the 0x Settler. Defaults to `direct` server-side.
 */
export type WrapUnwrapMode = "direct" | "settler";

/** Fee classification on `fees.*.type`. */
export type FeeType = "volume" | "gas";

/**
 * A single fee charged on a swap. `amount` and `token` are denominated in
 * the token's base units / contract address respectively.
 */
export interface ZeroxFee {
  amount: string;
  token: string;
  type: FeeType;
}

/**
 * Pre-trade issues the 0x API has detected. Surfaced so callers can fix
 * them before requesting a quote (e.g. prompt the user for an approval).
 *
 *  - `allowance` is non-null when the taker has insufficient allowance on
 *    the spender contract.
 *  - `balance` is non-null when the taker doesn't have enough `sellToken`.
 *  - `simulationIncomplete` means 0x couldn't fully simulate the trade.
 *  - `invalidSourcesPassed` echoes any names in `excludedSources` that
 *    didn't match a known liquidity source.
 */
export interface ZeroxIssues {
  allowance: {
    actual: string;
    spender: string;
  } | null;
  balance: {
    token: string;
    actual: string;
    expected: string;
  } | null;
  simulationIncomplete: boolean;
  invalidSourcesPassed: string[];
}

/**
 * Per-hop fill within a route. `proportionBps` is the share of the parent
 * (sellToken or intermediate) amount routed through this fill, in bps.
 */
export interface ZeroxFill {
  from: string;
  to: string;
  source: string;
  proportionBps: string;
}

/**
 * Token metadata that appears inside a route. Only `address` and `symbol`
 * are returned — pull decimals/name from your own token list if needed.
 */
export interface ZeroxRouteToken {
  address: string;
  symbol: string;
}

export interface ZeroxRoute {
  fills: ZeroxFill[];
  tokens: ZeroxRouteToken[];
}

/**
 * Honeypot / fee-on-transfer signals 0x has detected for the sell and buy
 * tokens. Each `*TaxBps` is either an object with the bps value or null
 * when the API couldn't determine it. Shape of the inner object is not
 * documented; treated as `unknown` until 0x publishes the schema.
 */
export interface ZeroxTokenTaxes {
  buyTaxBps: unknown | null;
  sellTaxBps: unknown | null;
  transferTaxBps: unknown | null;
}

export interface ZeroxTokenMetadata {
  buyToken: ZeroxTokenTaxes;
  sellToken: ZeroxTokenTaxes;
}

/** Common fee block shared by both response modes. */
export interface ZeroxFees {
  integratorFee: ZeroxFee | null;
  /** Present when multiple integrator fee recipients were specified. */
  integratorFees: ZeroxFee[] | null;
  zeroExFee: ZeroxFee | null;
  gasFee: ZeroxFee | null;
}

/**
 * Broadcastable transaction returned by quote endpoints. `to` is the 0x
 * router/settler — NEVER use it as the spender when setting ERC-20
 * allowances. Use `issues.allowance.spender` or the top-level
 * `allowanceTarget` for approvals.
 */
export interface ZeroxTransaction {
  /** Target contract for the call. NOT a valid allowance spender. */
  to: string;
  /** Calldata to attach to the transaction. */
  data: string;
  /** Estimated gas limit; shape not documented (object or null). */
  gas: unknown | null;
  /** Gas price in wei recommended by 0x. */
  gasPrice: string;
  /** `msg.value` in wei. Non-zero for native-token sells. */
  value: string;
}

// --- Permit2 EIP-712 -------------------------------------------------------

/** One field in an EIP-712 type definition (e.g. `{ name: "spender", type: "address" }`). */
export interface Permit2Eip712Field {
  name: string;
  type: string;
}

/** EIP-712 domain separator for the Permit2 signature. */
export interface Permit2Eip712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
  /** Optional per EIP-712; only present when 0x sets a domain salt. */
  salt?: string;
}

/**
 * The full EIP-712 typed-data payload to hand to the user's wallet for
 * signing (e.g. via viem's `signTypedData`). `types` is a map from type
 * name to its fields — `primaryType` names the root entry to sign. The
 * inner shape of `message` depends on `primaryType` (usually `PermitSingle`
 * for Permit2), so we type it as `Record<string, unknown>` rather than
 * narrowing — wallets accept the object verbatim.
 */
export interface Permit2Eip712 {
  types: Record<string, Permit2Eip712Field[]>;
  domain: Permit2Eip712Domain;
  message: Record<string, unknown>;
  primaryType: string;
}

/**
 * Permit2 approval payload returned on the Permit2 quote response.
 *
 * Sign `eip712` with the taker's wallet, then concatenate the resulting
 * 65-byte signature onto the end of `transaction.data` before broadcasting
 * (the trailing-signature pattern documented by 0x for Permit2 swaps).
 *
 * `null` on the parent response when the sell token is native or the trade
 * is a wrap/unwrap — no allowance is needed in those cases.
 */
export interface Permit2Approval {
  type: "Permit2";
  /**
   * EIP-712 hash of the payload. Useful for sanity-checking that a
   * locally-computed hash matches what 0x signed against.
   */
  hash: string;
  eip712: Permit2Eip712;
}

// --- /swap/allowance-holder/price ------------------------------------------

/**
 * Query parameters for `getAllowanceHolderPrice`. `chainId` is supplied by
 * the client (via `CallOptions.chainId` or `defaultChainId`), not here.
 *
 * Exactly one of `sellAmount` or `buyAmount` should be set:
 *   - `sellAmount` -> response is `mode: "exact-in"`
 *   - `buyAmount`  -> response is `mode: "exact-out"`
 */
export interface AllowanceHolderPriceParams {
  /** Contract address of the token being sold. Zero address = native. */
  sellToken: string;
  /** Contract address of the token being bought. Zero address = native. */
  buyToken: string;
  /** Amount of `sellToken` in its base units. Mutually exclusive with `buyAmount`. */
  sellAmount?: string;
  /** Amount of `buyToken` in its base units. Mutually exclusive with `sellAmount`. */
  buyAmount?: string;
  /** Address that holds the `sellToken` balance and the approval. */
  taker?: string;
  /** External account that originated the tx. Only needed when `taker` is a contract. */
  txOrigin?: string;
  /** Address to receive the `buyToken`. Defaults to `taker`. Not supported for wrap/unwrap. */
  recipient?: string;
  /** Wallet to receive trading fees. Comma-separated for multiple recipients. */
  swapFeeRecipient?: string;
  /** Bps of `swapFeeToken` to charge. Comma-separated for multiple recipients. Default cap: 1000. */
  swapFeeBps?: string;
  /** Token to receive fees in — must equal `buyToken` or `sellToken`. Comma-separated. */
  swapFeeToken?: string;
  /** Address to receive trade surplus. Restricted to selected integrators. */
  tradeSurplusRecipient?: string;
  /** Max trade surplus in bps of buy amount. Use with `tradeSurplusRecipient`. Default 10000. */
  tradeSurplusMaxBps?: number;
  /** Target gas price in wei. Defaults to 0x's oracle estimate. */
  gasPrice?: string;
  /** Max acceptable slippage in bps. Default 100 (1%). Mutually exclusive with `slippagePpm`. */
  slippageBps?: number;
  /** Max acceptable slippage in parts-per-million. Mutually exclusive with `slippageBps`. */
  slippagePpm?: number;
  /** Comma-separated liquidity sources to exclude. See `GET /sources?chainId=…`. */
  excludedSources?: string;
  /** If `'true'`, sell the taker's entire `sellToken` balance. */
  sellEntireBalance?: "true" | "false";
  /** Controls how wrap/unwrap is executed. Default `'direct'`. */
  wrapUnwrapMode?: WrapUnwrapMode;
}

/** Common fields shared by both `exact-in` and `exact-out` responses. */
interface AllowanceHolderPriceCommon {
  allowanceTarget: string | null;
  blockNumber: string;
  buyAmount: string;
  buyToken: string;
  fees: ZeroxFees;
  issues: ZeroxIssues;
  liquidityAvailable: boolean;
  sellToken: string;
  tokenMetadata: ZeroxTokenMetadata;
  /** Shape not documented by 0x; left as `unknown`. May be null. */
  totalNetworkFee: unknown | null;
  /** 0x request correlation ID — include in support tickets. */
  zid: string;
  /** Gas estimate object; shape not documented. May be null. */
  gas: unknown | null;
  gasPrice: string;
}

export interface AllowanceHolderPriceExactIn extends AllowanceHolderPriceCommon {
  mode: "exact-in";
  /** Worst-case `buyToken` amount after slippage. */
  minBuyAmount: string;
  sellAmount: string;
  route: ZeroxRoute;
}

export interface AllowanceHolderPriceExactOut extends AllowanceHolderPriceCommon {
  mode: "exact-out";
  /** Expected `sellToken` amount after fees and refunds. */
  estimatedNetSellAmount: string;
  /** Worst-case `sellToken` amount before any refund. */
  maxSellAmount: string;
  routes: {
    forward: ZeroxRoute;
    /** Refund leg for any unspent `sellToken`. Null when not applicable. */
    refund: ZeroxRoute | null;
  };
}

/**
 * Returned when 0x has no liquidity available for the requested pair on
 * the given chain. Distinguished by `liquidityAvailable: false` and the
 * absence of a `mode` field — callers must narrow before reading other
 * fields.
 */
export interface AllowanceHolderPriceNoLiquidity {
  liquidityAvailable: false;
  zid: string;
}

/**
 * Discriminated union of every `/swap/allowance-holder/price` response.
 * Narrow first via `liquidityAvailable`, then via `mode`.
 */
export type AllowanceHolderPriceResponse =
  | AllowanceHolderPriceExactIn
  | AllowanceHolderPriceExactOut
  | AllowanceHolderPriceNoLiquidity;

function denormalizeRoute(route: ZeroxRoute): ZeroxRoute {
  return {
    fills: route.fills.map((f) => ({
      ...f,
      from: denormalizeNativeAddress(f.from),
      to: denormalizeNativeAddress(f.to),
    })),
    tokens: route.tokens.map((t) => ({
      ...t,
      address: denormalizeNativeAddress(t.address),
    })),
  };
}

function denormalizeFee(fee: ZeroxFee | null): ZeroxFee | null {
  if (!fee) return fee;
  return { ...fee, token: denormalizeNativeAddress(fee.token) };
}

function denormalizeFees(fees: ZeroxFees): ZeroxFees {
  return {
    integratorFee: denormalizeFee(fees.integratorFee),
    integratorFees:
      fees.integratorFees?.map((f) => denormalizeFee(f) as ZeroxFee) ?? null,
    zeroExFee: denormalizeFee(fees.zeroExFee),
    gasFee: denormalizeFee(fees.gasFee),
  };
}

function denormalizeIssues(issues: ZeroxIssues): ZeroxIssues {
  return {
    ...issues,
    balance: issues.balance
      ? { ...issues.balance, token: denormalizeNativeAddress(issues.balance.token) }
      : null,
  };
}

function denormalizeAllowanceHolderPriceResponse(
  r: AllowanceHolderPriceResponse
): AllowanceHolderPriceResponse {
  if (r.liquidityAvailable === false && !("mode" in r)) return r;
  const common = r as AllowanceHolderPriceExactIn | AllowanceHolderPriceExactOut;
  const base = {
    ...common,
    buyToken: denormalizeNativeAddress(common.buyToken),
    sellToken: denormalizeNativeAddress(common.sellToken),
    fees: denormalizeFees(common.fees),
    issues: denormalizeIssues(common.issues),
  };
  if (common.mode === "exact-in") {
    return { ...base, route: denormalizeRoute(common.route) } as AllowanceHolderPriceExactIn;
  }
  return {
    ...base,
    routes: {
      forward: denormalizeRoute(common.routes.forward),
      refund: common.routes.refund ? denormalizeRoute(common.routes.refund) : null,
    },
  } as AllowanceHolderPriceExactOut;
}

// --- /swap/allowance-holder/quote ------------------------------------------

/**
 * Query parameters for `getAllowanceHolderQuote`. Same surface as
 * `AllowanceHolderPriceParams` except `taker` is required — the quote
 * endpoint needs to know whose balance/allowance to check and builds
 * calldata that targets that taker.
 *
 * Exactly one of `sellAmount` or `buyAmount` should be set (drives
 * `mode: "exact-in"` vs `mode: "exact-out"` in the response).
 */
export interface AllowanceHolderQuoteParams {
  sellToken: string;
  buyToken: string;
  /** Address that holds the `sellToken` balance and the approval. Required. */
  taker: string;
  sellAmount?: string;
  buyAmount?: string;
  txOrigin?: string;
  recipient?: string;
  swapFeeRecipient?: string;
  swapFeeBps?: string;
  swapFeeToken?: string;
  tradeSurplusRecipient?: string;
  tradeSurplusMaxBps?: number;
  gasPrice?: string;
  slippageBps?: number;
  slippagePpm?: number;
  excludedSources?: string;
  sellEntireBalance?: "true" | "false";
  wrapUnwrapMode?: WrapUnwrapMode;
}

/**
 * Fields shared by both quote modes. Differs from the price response
 * common base in that `gas` and `gasPrice` live inside `transaction`
 * instead of at the top level — the quote always carries an executable
 * `transaction` payload.
 */
interface AllowanceHolderQuoteCommon {
  allowanceTarget: string | null;
  blockNumber: string;
  buyAmount: string;
  buyToken: string;
  fees: ZeroxFees;
  issues: ZeroxIssues;
  liquidityAvailable: boolean;
  sellToken: string;
  tokenMetadata: ZeroxTokenMetadata;
  totalNetworkFee: unknown | null;
  zid: string;
  transaction: ZeroxTransaction;
}

export interface AllowanceHolderQuoteExactIn extends AllowanceHolderQuoteCommon {
  mode: "exact-in";
  minBuyAmount: string;
  sellAmount: string;
  route: ZeroxRoute;
}

export interface AllowanceHolderQuoteExactOut extends AllowanceHolderQuoteCommon {
  mode: "exact-out";
  /**
   * Per 0x: "Exact-out v1 does not support fees" — `fees.*` fields will
   * be null even when the equivalent exact-in quote would have populated them.
   */
  estimatedNetSellAmount: string;
  maxSellAmount: string;
  routes: {
    forward: ZeroxRoute;
    /** Converts buy-token surplus back to sell token. Null when not needed. */
    refund: ZeroxRoute | null;
  };
}

/** Returned when 0x has no liquidity for the requested pair on this chain. */
export interface AllowanceHolderQuoteNoLiquidity {
  liquidityAvailable: false;
  zid: string;
}

/**
 * Discriminated union of every `/swap/allowance-holder/quote` response.
 * Narrow first via `liquidityAvailable`, then via `mode`.
 */
export type AllowanceHolderQuoteResponse =
  | AllowanceHolderQuoteExactIn
  | AllowanceHolderQuoteExactOut
  | AllowanceHolderQuoteNoLiquidity;

function denormalizeAllowanceHolderQuoteResponse(
  r: AllowanceHolderQuoteResponse
): AllowanceHolderQuoteResponse {
  if (r.liquidityAvailable === false && !("mode" in r)) return r;
  const common = r as AllowanceHolderQuoteExactIn | AllowanceHolderQuoteExactOut;
  // NOTE: deliberately do NOT rewrite `transaction.to` — it's the 0x
  // router/settler, not a token. Same goes for `allowanceTarget`.
  const base = {
    ...common,
    buyToken: denormalizeNativeAddress(common.buyToken),
    sellToken: denormalizeNativeAddress(common.sellToken),
    fees: denormalizeFees(common.fees),
    issues: denormalizeIssues(common.issues),
  };
  if (common.mode === "exact-in") {
    return { ...base, route: denormalizeRoute(common.route) } as AllowanceHolderQuoteExactIn;
  }
  return {
    ...base,
    routes: {
      forward: denormalizeRoute(common.routes.forward),
      refund: common.routes.refund ? denormalizeRoute(common.routes.refund) : null,
    },
  } as AllowanceHolderQuoteExactOut;
}

// --- /swap/permit2/price ---------------------------------------------------

/**
 * Query parameters for `getPermit2Price`. Identical surface to the
 * AllowanceHolder price endpoint — Permit2's distinction is in the
 * approval mechanism, not in the price request shape.
 */
export type Permit2PriceParams = AllowanceHolderPriceParams;

/**
 * Response shapes for `getPermit2Price`. Byte-for-byte identical to the
 * AllowanceHolder price response — the difference between the two flows
 * only shows up at quote/execution time (Permit2 swaps approve the
 * Permit2 contract once, then permit per-trade via signature).
 */
export type Permit2PriceExactIn = AllowanceHolderPriceExactIn;
export type Permit2PriceExactOut = AllowanceHolderPriceExactOut;
export type Permit2PriceNoLiquidity = AllowanceHolderPriceNoLiquidity;
export type Permit2PriceResponse = AllowanceHolderPriceResponse;

// --- /swap/permit2/quote ---------------------------------------------------

/**
 * Query parameters for `getPermit2Quote`. Identical surface to the
 * AllowanceHolder quote endpoint (including the required `taker`).
 */
export type Permit2QuoteParams = AllowanceHolderQuoteParams;

/**
 * Fields shared by both Permit2 quote modes. Extends the AllowanceHolder
 * quote common base with `permit2`: an EIP-712 typed-data payload the
 * taker must sign before the swap can be submitted.
 *
 * `permit2` is `null` when no signature is needed — i.e. when the sell
 * token is native or the trade is a wrap/unwrap.
 */
interface Permit2QuoteCommon extends AllowanceHolderQuoteCommon {
  permit2: Permit2Approval | null;
}

export interface Permit2QuoteExactIn extends Permit2QuoteCommon {
  mode: "exact-in";
  minBuyAmount: string;
  sellAmount: string;
  route: ZeroxRoute;
}

export interface Permit2QuoteExactOut extends Permit2QuoteCommon {
  mode: "exact-out";
  /** Exact-out v1 does not support fees — `fees.*` will be null. */
  estimatedNetSellAmount: string;
  maxSellAmount: string;
  routes: {
    forward: ZeroxRoute;
    refund: ZeroxRoute | null;
  };
}

export interface Permit2QuoteNoLiquidity {
  liquidityAvailable: false;
  zid: string;
}

/**
 * Discriminated union of every `/swap/permit2/quote` response. Narrow
 * first via `liquidityAvailable`, then via `mode`. Signature flow:
 *   1. Read `permit2.eip712` and sign with the taker's wallet.
 *   2. Append the 65-byte signature to `transaction.data` (per 0x's
 *      Permit2-swap convention).
 *   3. Broadcast the resulting transaction to `transaction.to`.
 */
export type Permit2QuoteResponse =
  | Permit2QuoteExactIn
  | Permit2QuoteExactOut
  | Permit2QuoteNoLiquidity;

function denormalizePermit2QuoteResponse(
  r: Permit2QuoteResponse
): Permit2QuoteResponse {
  if (r.liquidityAvailable === false && !("mode" in r)) return r;
  const common = r as Permit2QuoteExactIn | Permit2QuoteExactOut;
  // As with AllowanceHolder: do NOT touch `transaction.to`, `allowanceTarget`,
  // or anything inside `permit2.eip712` — that payload must be signed verbatim.
  const base = {
    ...common,
    buyToken: denormalizeNativeAddress(common.buyToken),
    sellToken: denormalizeNativeAddress(common.sellToken),
    fees: denormalizeFees(common.fees),
    issues: denormalizeIssues(common.issues),
  };
  if (common.mode === "exact-in") {
    return { ...base, route: denormalizeRoute(common.route) } as Permit2QuoteExactIn;
  }
  return {
    ...base,
    routes: {
      forward: denormalizeRoute(common.routes.forward),
      refund: common.routes.refund ? denormalizeRoute(common.routes.refund) : null,
    },
  } as Permit2QuoteExactOut;
}

// --- Error -----------------------------------------------------------------

/**
 * Documented error names per the 0x API reference. The union covers every
 * `name` 0x returns at the time of writing; the open string fallback lets
 * callers handle new codes without an SDK bump.
 */
export type ZeroxErrorName =
  // 400
  | "INPUT_INVALID"
  | "RECIPIENT_NOT_SUPPORTED"
  | "SWAP_VALIDATION_FAILED"
  | "TOKEN_NOT_SUPPORTED"
  | "USER_NOT_AUTHORIZED"
  // 403
  | "TAKER_NOT_AUTHORIZED_FOR_TRADE"
  | "RECIPIENT_NOT_AUTHORIZED_FOR_TRADE"
  | "XSTOCKS_NOT_AUTHORIZED"
  // 422
  | "BUY_TOKEN_NOT_AUTHORIZED_FOR_TRADE"
  | "SELL_TOKEN_NOT_AUTHORIZED_FOR_TRADE"
  // 500
  | "INTERNAL_SERVER_ERROR"
  | "UNCATEGORIZED"
  // deno-lint-ignore ban-types
  | (string & {});

/**
 * Field-level validation issue returned inside `data.details` for
 * `INPUT_INVALID` responses.
 */
export interface ZeroxInputDetail {
  field: string;
  reason: string;
}

/**
 * 0x error envelope returned on 4xx/5xx. Real shape is
 * `{ name, message, data: { zid, ...extras } }`. All fields are optional
 * because not every endpoint returns the full structure.
 */
export interface ZeroxApiError {
  name?: ZeroxErrorName;
  message?: string;
  data?: {
    /** 0x request correlation ID — include in support tickets. */
    zid?: string;
    /** Present on `INPUT_INVALID`. */
    details?: ZeroxInputDetail[];
    [extra: string]: unknown;
  };
}

/**
 * Thrown for any non-2xx response from the 0x API. Carries HTTP status,
 * the upstream `name` and `zid`, and the parsed body so callers can
 * branch on documented error codes (e.g. `INSUFFICIENT_LIQUIDITY`).
 */
export class ZeroxError extends Error {
  readonly status: number;
  readonly code?: ZeroxErrorName;
  readonly zid?: string;
  readonly details?: unknown;
  readonly body?: unknown;

  constructor(args: {
    message: string;
    status: number;
    code?: ZeroxErrorName;
    zid?: string;
    details?: unknown;
    body?: unknown;
  }) {
    super(args.message);
    this.name = "ZeroxError";
    this.status = args.status;
    this.code = args.code;
    this.zid = args.zid;
    this.details = args.details;
    this.body = args.body;
  }
}

// --- Client options --------------------------------------------------------

export interface ZeroxClientOptions {
  /**
   * 0x API key. Sent as the `0x-api-key` header. Generate one at
   * https://dashboard.0x.org. Required — requests without it are rejected.
   */
  apiKey: string;
  /** Override the API host (e.g. for staging). */
  baseUrl?: string;
  /**
   * If set on the client, every method may omit its own `chainId` and use
   * this default. Per-call `chainId` always wins.
   */
  defaultChainId?: ZeroxChainId;
  /** Custom fetch implementation (testing, retries, instrumentation). */
  fetch?: typeof fetch;
  /** Per-request timeout in ms. Omit to disable. */
  timeoutMs?: number;
}

export interface CallOptions {
  /** Override the chain for this single call. */
  chainId?: ZeroxChainId;
  /** External AbortSignal — composes with `timeoutMs` if both are set. */
  signal?: AbortSignal;
}

// --- Client ----------------------------------------------------------------

export class ZeroxClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultChainId?: ZeroxChainId;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs?: number;

  constructor(options: ZeroxClientOptions) {
    if (!options.apiKey) {
      throw new Error("ZeroxClient: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.defaultChainId = options.defaultChainId;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs;
  }

  /**
   * `GET /swap/allowance-holder/price` — indicative pricing for a swap
   * under the AllowanceHolder approval model. Cheaper than `quote` (no
   * signature payload built), so prefer for live previews while the user
   * is still typing. Switch to `getAllowanceHolderQuote` for execution.
   *
   * Either `sellAmount` (exact-in) or `buyAmount` (exact-out) must be set.
   * Returns a discriminated union on `mode` / `liquidityAvailable` — see
   * `AllowanceHolderPriceResponse`.
   */
  async getAllowanceHolderPrice(
    params: AllowanceHolderPriceParams,
    options: CallOptions = {}
  ): Promise<AllowanceHolderPriceResponse> {
    const chainId = this.resolveChainId(options.chainId);
    const query: AllowanceHolderPriceParams & { chainId: number } = {
      ...params,
      chainId,
      sellToken: normalizeNativeAddress(params.sellToken),
      buyToken: normalizeNativeAddress(params.buyToken),
    };
    const result = await this.request<AllowanceHolderPriceResponse>(
      "GET",
      "/swap/allowance-holder/price",
      query,
      undefined,
      options.signal
    );
    return denormalizeAllowanceHolderPriceResponse(result);
  }

  /**
   * `GET /swap/allowance-holder/quote` — firm, executable quote under the
   * AllowanceHolder approval model. Returns the same shape as
   * `getAllowanceHolderPrice` plus a `transaction` object the caller can
   * submit verbatim (after handling any `issues.allowance`).
   *
   * `taker` is required here (unlike price). For ERC-20 approvals, set the
   * allowance on `issues.allowance.spender` / `allowanceTarget` — NEVER on
   * `transaction.to`, which is the 0x router and would burn allowance.
   *
   * Either `sellAmount` (exact-in) or `buyAmount` (exact-out) must be set.
   */
  async getAllowanceHolderQuote(
    params: AllowanceHolderQuoteParams,
    options: CallOptions = {}
  ): Promise<AllowanceHolderQuoteResponse> {
    const chainId = this.resolveChainId(options.chainId);
    const query: AllowanceHolderQuoteParams & { chainId: number } = {
      ...params,
      chainId,
      sellToken: normalizeNativeAddress(params.sellToken),
      buyToken: normalizeNativeAddress(params.buyToken),
    };
    const result = await this.request<AllowanceHolderQuoteResponse>(
      "GET",
      "/swap/allowance-holder/quote",
      query,
      undefined,
      options.signal
    );
    return denormalizeAllowanceHolderQuoteResponse(result);
  }

  /**
   * `GET /swap/permit2/price` — indicative pricing for a swap that will be
   * executed via Permit2 signature-based approvals. Request/response shape
   * is identical to `getAllowanceHolderPrice` — the Permit2 distinction
   * only matters at quote/execution time.
   *
   * Use for live previews; switch to `getPermit2Quote` for execution.
   */
  async getPermit2Price(
    params: Permit2PriceParams,
    options: CallOptions = {}
  ): Promise<Permit2PriceResponse> {
    const chainId = this.resolveChainId(options.chainId);
    const query: Permit2PriceParams & { chainId: number } = {
      ...params,
      chainId,
      sellToken: normalizeNativeAddress(params.sellToken),
      buyToken: normalizeNativeAddress(params.buyToken),
    };
    const result = await this.request<Permit2PriceResponse>(
      "GET",
      "/swap/permit2/price",
      query,
      undefined,
      options.signal
    );
    // Reuse the AllowanceHolder denormalizer — the shapes match exactly.
    return denormalizeAllowanceHolderPriceResponse(
      result as AllowanceHolderPriceResponse
    ) as Permit2PriceResponse;
  }

  /**
   * `GET /swap/permit2/quote` — firm, executable quote under the Permit2
   * approval model. Returns the same shape as `getAllowanceHolderQuote`
   * plus a `permit2` field carrying an EIP-712 typed-data payload.
   *
   * Execution flow:
   *   1. If `permit2` is non-null, sign `permit2.eip712` with the taker's
   *      wallet (viem: `signTypedData`).
   *   2. Append the 65-byte signature to `transaction.data` before sending
   *      — that's the trailing-signature convention 0x's settler expects.
   *   3. Broadcast to `transaction.to`.
   *
   * The Permit2 contract must be approved once per sell token before any
   * trade; check `issues.allowance.spender` against the taker's existing
   * Permit2 allowance and prompt for an `approve()` if needed.
   *
   * `permit2` is `null` when the sell token is native or the operation is
   * a wrap/unwrap (no signature required).
   */
  async getPermit2Quote(
    params: Permit2QuoteParams,
    options: CallOptions = {}
  ): Promise<Permit2QuoteResponse> {
    const chainId = this.resolveChainId(options.chainId);
    const query: Permit2QuoteParams & { chainId: number } = {
      ...params,
      chainId,
      sellToken: normalizeNativeAddress(params.sellToken),
      buyToken: normalizeNativeAddress(params.buyToken),
    };
    const result = await this.request<Permit2QuoteResponse>(
      "GET",
      "/swap/permit2/quote",
      query,
      undefined,
      options.signal
    );
    return denormalizePermit2QuoteResponse(result);
  }

  // Endpoint methods will be added here as specs are finalized:
  //   getGaslessPrice        / getGaslessQuote / submitGasless / getGaslessStatus
  //   getSources
  //   getTradeAnalyticsSwap

  // --- internals -----------------------------------------------------------

  /**
   * Resolve a per-call `chainId` against `defaultChainId`. Throws if neither
   * is set, since every 0x endpoint requires a chain.
   */
  private resolveChainId(perCall?: ZeroxChainId): ZeroxChainId {
    const chainId = perCall ?? this.defaultChainId;
    if (chainId === undefined) {
      throw new Error(
        "ZeroxClient: chainId must be supplied either via `defaultChainId` " +
          "in the constructor or `options.chainId` on the call"
      );
    }
    return chainId;
  }

  /**
   * Issue a request against the 0x API. Endpoint methods build a path and
   * params object, then delegate here. Auth headers, version pinning,
   * timeout composition, and error mapping all live in one place.
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    params: object | undefined,
    body: unknown,
    externalSignal?: AbortSignal
  ): Promise<T> {
    const url =
      `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}` +
      (params ? toQueryString(params) : "");

    const headers: Record<string, string> = {
      "0x-api-key": this.apiKey,
      "0x-version": ZEROX_API_VERSION,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const { signal, cancel } = composeSignals(externalSignal, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } finally {
      cancel();
    }

    const text = await response.text();
    const parsed = text.length > 0 ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      const err = (parsed as ZeroxApiError | undefined) ?? {};
      throw new ZeroxError({
        message:
          err.message ?? `0x HTTP ${response.status} ${response.statusText}`,
        status: response.status,
        code: err.name,
        zid: err.data?.zid,
        details: err.data?.details,
        body: parsed,
      });
    }

    return parsed as T;
  }
}

// --- helpers ---------------------------------------------------------------

/**
 * Exposed for endpoint methods that need to translate caller-supplied
 * token addresses to 0x's sentinel form before serializing, and to rewrite
 * responses back to the zero-address frontend convention.
 */
export const _internals = {
  normalizeNativeAddress,
  denormalizeNativeAddress,
};

/**
 * Build a `?key=value&...` query string from a flat params object. Skips
 * `undefined` and `null`, stringifies booleans as `"true"`/`"false"`, and
 * URL-encodes everything. Returns `""` if the resulting string is empty so
 * callers can concatenate unconditionally.
 */
function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.append(
      key,
      typeof value === "boolean" ? String(value) : String(value)
    );
  }
  const s = search.toString();
  return s.length > 0 ? `?${s}` : "";
}

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
            new Error(`0x request timed out after ${timeoutMs}ms`)
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
