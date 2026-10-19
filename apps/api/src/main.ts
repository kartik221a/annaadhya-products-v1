/** NestJS bootstrap — Swagger/OpenAPI, global prefix, CORS, raw-body webhooks, lifecycle jobs. */
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

  await app.listen(env.PORT, "0.0.0.0");

  // Reservation expiry sweeper (also callable via admin endpoint)
  const checkout = app.get(CHECKOUT_SWEEPER) as { releaseExpiredReservations(): Promise<unknown> } | undefined;
  if (checkout) {
    setInterval(() => {
      checkout.releaseExpiredReservations().catch((err) => {
        console.warn("[reservations] expiry sweep failed:", err instanceof Error ? err.message : err);
      });
    }, 5 * 60 * 1000).unref?.();
  }

  console.info(`Annaadhya API listening on :${env.PORT} (prefix /api/v1, docs at /api/docs)`);
  console.info(
    `Mode: provider=${env.DATA_PROVIDER} auth=${env.firebaseConfigured ? "firebase" : "mock-dev-tokens"} payments=${env.PAYMENT_PROVIDER}${env.isProduction ? " PRODUCTION" : " (sandbox)"}`,
  );
}

import { CHECKOUT_SWEEPER } from "./app.tokens";

void bootstrap();
