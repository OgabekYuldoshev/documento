import { trpcServer } from "@hono/trpc-server";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { appRouter } from "./app-router";
import { env } from "./config/env";
import { auth } from "./lib/auth";
import { assetsRoute } from "./modules/assets/assets.route";
import { changePasswordGuard, signInGuard } from "./modules/auth/auth.guard";
import { generationsRoute } from "./modules/generations/generations.route";
import { previewsRoute } from "./modules/previews/previews.route";
import { uploadsRoute } from "./modules/uploads/uploads.route";
import { v1 } from "./modules/v1/v1.route";
import { createContext } from "./trpc/init";

export const app = new Hono();

app.use(logger());
app.use(secureHeaders());
app.use(
  "/api/*",
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Reject oversized bodies before anything parses them (tRPC and auth read whole JSON bodies).
const tooLarge = (c: Context) => c.json({ message: "So'rov hajmi juda katta" }, 413);
app.use(
  "/api/trpc/*",
  bodyLimit({ maxSize: env.TRPC_BODY_LIMIT_MB * 1024 * 1024, onError: tooLarge }),
);
app.use("/api/auth/*", bodyLimit({ maxSize: 1024 * 1024, onError: tooLarge }));

app.get("/health", (c) => c.json({ ok: true }));

// User provisioning/management goes exclusively through tRPC (role-checked, superadmin-protected).
app.all("/api/auth/admin/*", (c) => c.json({ message: "Not found" }, 404));
app.all("/api/auth/sign-up/*", (c) => c.json({ message: "Not found" }, 404));

app.use("/api/auth/sign-in/email", signInGuard);
app.use("/api/auth/change-password", changePasswordGuard);
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/", assetsRoute);
app.route("/", generationsRoute);
app.route("/", previewsRoute);
app.route("/", uploadsRoute);
// External integration API: key-authenticated, no CORS (server-to-server).
app.route("/v1", v1);

app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext: (_opts, c) => createContext({ headers: c.req.raw.headers }),
  }),
);

app.notFound((c) => c.json({ message: "Not found" }, 404));
