/** NestJS bootstrap — Swagger/OpenAPI, global prefix, CORS, raw-body webhooks, lifecycle jobs. */
import * as http from "node:http";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { loadEnv } from "./config/env";
import { applySeed, InMemoryDataClient } from "@annaadhya/data-core";
import type { DataClient } from "@annaadhya/data-core";
import { DATA_CLIENT } from "./data/data.module";

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = await NestFactory.create(AppModule, {
    rawBody: true, // required for webhook signature verification
    logger: ["error", "warn", "log"],
  });

  app.setGlobalPrefix("api/v1", { exclude: ["api/docs", "api/docs-json"] });

  app.enableCors({
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
    credentials: true,
  });

  // Swagger — the API contract surface for both frontends
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Annaadhya Products API")
    .setDescription(
      "REST API for the Annaadhya e-commerce platform. " +
        "Authentication: Firebase ID tokens (mock-mode dev tokens in development). " +
        "All amounts are integer paise.",
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  // Mock-mode convenience: auto-seed the in-memory provider so the demo store is usable instantly.
  if (env.DATA_PROVIDER === "memory") {
    try {
      const data = app.get<DataClient>(DATA_CLIENT);
      if (data instanceof InMemoryDataClient) {
        const productCount = await data.count("products");
        if (productCount === 0) {
          const report = await applySeed(data);
          console.info(
            `[mock-mode] Seeded demo dataset: ${report.counts.products} products, ${report.counts.variants} variants, ${report.counts.orders} demo orders.`,
          );
        }
      }
    } catch (err) {
      console.warn("[mock-mode] Auto-seed failed:", err instanceof Error ? err.message : err);
    }
  }

  // Vercel's Node runtime probes the PORT it injects; fall back to 3000 exactly like
  // Vercel's documented NestJS example (process.env.PORT ?? 3000). A mismatch here
  // would look like FUNCTION_INVOCATION_FAILED with no error in the logs.
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, "0.0.0.0");

  // Reservation expiry sweeper (also callable via admin endpoint)
  const checkout = app.get(CHECKOUT_SWEEPER) as { releaseExpiredReservations(): Promise<unknown> } | undefined;
  if (checkout) {
    setInterval(() => {
      checkout.releaseExpiredReservations().catch((err) => {
        console.warn("[reservations] expiry sweep failed:", err instanceof Error ? err.message : err);
      });
    }, 5 * 60 * 1000).unref?.();
  }

  console.info(`Annaadhya API listening on :${port} (prefix /api/v1, docs at /api/docs)`);
  console.info(
    `Mode: provider=${env.DATA_PROVIDER} auth=${env.firebaseConfigured ? "firebase" : "mock-dev-tokens"} payments=${env.PAYMENT_PROVIDER}${env.isProduction ? " PRODUCTION" : " (sandbox)"}`,
  );
}

import { CHECKOUT_SWEEPER } from "./app.tokens";

/**
 * Boot-error visibility: if bootstrap throws (invalid env, DI failure, listen failure),
 * still bind the port and report the exact reason over HTTP instead of crashing with a
 * bare 500 FUNCTION_INVOCATION_FAILED that hides the root cause from the platform.
 * Deliberately minimal: message + first stack frames, no env values echoed back.
 */
bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const stack = err instanceof Error ? (err.stack ?? "").split("\n").slice(1, 6).join("\n") : "";
  const body = `Annaadhya API failed to boot. Fix the environment and redeploy.\n\n${message}\n${stack}`;
  console.error("[boot] API failed to start:", message, "\n", stack);

  const server = http.createServer((_req, res) => {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(body);
  });
  server.on("error", (e) => console.error("[boot] error-report server failed:", e));
  server.listen(Number(process.env.PORT) || 3000, "0.0.0.0");
});
