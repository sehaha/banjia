// Type declarations for lark-core.js. Place next to the module so TS/editors pick
// it up automatically (or reference it explicitly). See docs/lark-integration.md.

/** How `receiveId` is interpreted by the IM API. Groups use 'chat_id'. */
export type ReceiveIdType = 'open_id' | 'user_id' | 'union_id' | 'chat_id' | 'email';

/** Header color for an interactive card. */
export type CardTemplate =
  | 'blue' | 'wathet' | 'turquoise' | 'green' | 'yellow' | 'orange'
  | 'red' | 'carmine' | 'violet' | 'purple' | 'indigo' | 'grey' | 'default';

/** Button style. */
export type ButtonType = 'default' | 'primary' | 'danger';

/** An element inside a card body (markdown / hr / button / …). */
export interface CardElement {
  tag: string;
  [key: string]: unknown;
}

/** A card 2.0 message body (pass to sendCard). */
export interface CardBody {
  schema: '2.0';
  config: { wide_screen_mode: boolean };
  header: { title: { tag: 'plain_text'; content: string }; template: CardTemplate };
  body: { elements: CardElement[] };
}

/** Raw Lark API envelope: `code === 0` means success. */
export interface LarkApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

/** Result of a send call. */
export interface SendResult {
  ok: boolean;
  code?: number;
  msg?: string;
  messageId?: string;
}

/** Result of a broadcast. */
export interface BroadcastResult {
  ok: boolean;
  sent: number;
  total: number;
  results: (SendResult & { id: string })[];
}

/** True when LARK_APP_ID and LARK_APP_SECRET are both set. */
export function larkConfigured(): boolean;

/** Get a cached tenant_access_token (refreshes ~120s before expiry). */
export function getTenantToken(): Promise<string>;

/** Call any Lark Open API. Adds auth + JSON headers, returns the parsed body. */
export function larkApi<T = unknown>(
  path: string,
  opts?: { method?: string; body?: unknown; query?: Record<string, string> },
): Promise<LarkApiResponse<T>>;

/** Low-level send. `content` is the message content object (stringified for you). */
export function sendMessage(
  receiveId: string,
  opts: { msgType: string; content: unknown; receiveIdType?: ReceiveIdType },
): Promise<SendResult>;

export function sendText(id: string, text: string, receiveIdType?: ReceiveIdType): Promise<SendResult>;
export function sendCard(id: string, cardBody: CardBody, receiveIdType?: ReceiveIdType): Promise<SendResult>;
export function sendCardToMany(ids: string[], cardBody: CardBody, receiveIdType?: ReceiveIdType): Promise<BroadcastResult>;

// ---- card 2.0 builders ----
export function card(opts: { title: string; template?: CardTemplate; elements?: CardElement[] }): CardBody;
export function md(content: string): CardElement;
export function hr(): CardElement;
export function openUrlButton(text: string, url: string, type?: ButtonType): CardElement;
export function callbackButton(text: string, value: Record<string, unknown>, type?: ButtonType): CardElement;

// ---- event webhook ----
/** Decrypt an AES-256-CBC encrypted event payload. */
export function decryptEvent(encrypt: string, key: string): unknown;
/** Decrypt if an Encrypt Key is set (rejects plaintext → null); else pass through. */
export function parseEvent(body: unknown, opts?: { encryptKey?: string }): any | null;
/** Verify the optional Verification Token. Returns true when it matches or is unset. */
export function verifyToken(evt: unknown, token?: string): boolean;

/** Cross-instance event dedup via Upstash Redis (SET NX EX). True = already seen. */
export function seenEvent(id: string, ttlSec?: number): Promise<boolean>;
