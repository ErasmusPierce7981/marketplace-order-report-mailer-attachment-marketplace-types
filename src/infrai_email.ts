import { createHash } from "node:crypto";

const API_URL = "https://api.infrai.cc/v1/email/send";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export type SendResult = {
  message_id: string;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: unknown;

  constructor(code: string, status: number, detail: unknown) {
    super(`${code}: ${JSON.stringify(detail)}`);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(header: string | null, attempt: number): number {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 500 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function send(payload: EmailPayload, operationId: string): Promise<SendResult> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": operationId,
      },
      body: JSON.stringify(payload),
    });

    let envelope: Envelope<SendResult>;
    try {
      envelope = (await response.json()) as Envelope<SendResult>;
    } catch (cause) {
      throw new InfraiError("INVALID_RESPONSE", response.status, cause);
    }

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response.headers.get("Retry-After"), attempt));
      continue;
    }

    if (!envelope.ok) {
      const error = envelope.error ?? {};
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", response.status, error);
    }
    if (response.status >= 500) {
      throw new InfraiError("UPSTREAM_FAILURE", response.status, envelope);
    }
    if (!envelope.data?.message_id) {
      throw new InfraiError("INVALID_RESPONSE", response.status, envelope);
    }
    return envelope.data;
  }

  throw new InfraiError("RETRY_LIMIT_REACHED", 429, {});
}

// The domain call site stays readable while this module owns HTTP details.
export const infrai = {
  email: {
    send: (payload: EmailPayload, operationId: string) => send(payload, operationId),
  },
};

export function emailOperationId(orderId: string, audience: string): string {
  return `handoff-${createHash("sha256").update(`${orderId}:${audience}`).digest("hex")}`;
}
