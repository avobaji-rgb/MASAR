import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY) {
  app.use(clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
  })));
} else {
  // Keep liveness and sanitized public directory available while auth is not configured.
  // Never let a protected request fall through into getAuth() without Clerk middleware.
  app.use("/api", (req, res, next) => {
    if ((req.method === "GET" && req.path === "/healthz")
        || (req.method === "GET" && (req.path === "/partners/public" || req.path.startsWith("/partners/public/")))) return next();
    res.status(503).json({ error: "Authentication service is not configured" });
  });
  logger.warn("Clerk is not configured; protected API endpoints are disabled");
}

app.use("/api", router);

export default app;
