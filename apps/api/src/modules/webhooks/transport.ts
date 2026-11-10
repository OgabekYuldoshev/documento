import { lookup } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { env } from "../../config/env";
import { allowPrivate, assertDeliverableUrl, isPublicAddress, UrlRejected } from "./url-guard";

export type TransportResult = {
  statusCode: number | null;
  error: string | null;
  durationMs: number;
};

export type Transport = (
  url: string,
  body: string,
  headers: Record<string, string>,
) => Promise<TransportResult>;

const MAX_ERROR = 300;

/**
 * POST with a connect-time DNS check, so a hostname that resolves to a private address (or flips
 * there after validation) is refused. Redirects are never followed.
 */
export const httpTransport: Transport = async (rawUrl, body, headers) => {
  const started = Date.now();
  const done = (statusCode: number | null, error: string | null): TransportResult => ({
    statusCode,
    error: error ? error.slice(0, MAX_ERROR) : null,
    durationMs: Date.now() - started,
  });

  let url: URL;
  try {
    url = assertDeliverableUrl(rawUrl);
  } catch (e) {
    return done(null, e instanceof UrlRejected ? e.message : "Manzil noto'g'ri");
  }

  return new Promise<TransportResult>((resolve) => {
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = send(
      url,
      {
        method: "POST",
        headers: { ...headers, "content-length": String(Buffer.byteLength(body)) },
        lookup: (hostname, options, callback) => {
          lookup(hostname, options, (err, addresses, family) => {
            if (err) return callback(err, addresses, family);
            const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family }];
            if (!allowPrivate() && list.some((a) => !isPublicAddress(a.address))) {
              return callback(new Error("Ichki manzilga yuborib bo'lmaydi"), "", 4);
            }
            return (callback as (e: null, a: unknown) => void)(null, addresses);
          });
        },
      },
      (res) => {
        res.resume(); // the body is irrelevant; drain it so the socket frees
        const code = res.statusCode ?? 0;
        if (code >= 200 && code < 300) return resolve(done(code, null));
        resolve(
          done(
            code,
            code >= 300 && code < 400 ? "Yo'naltirish (redirect) qo'llanmaydi" : `HTTP ${code}`,
          ),
        );
      },
    );
    req.setTimeout(env.WEBHOOK_TIMEOUT_MS, () => req.destroy(new Error("Vaqt tugadi (timeout)")));
    req.on("error", (e) => resolve(done(null, e.message)));
    req.end(body);
  });
};
