import path from "node:path";
import fs from "node:fs";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

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
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Mount API routes
app.use("/api", router);

// Serve static frontend assets
const candidatePaths = [
  path.resolve(process.cwd(), "artifacts/streamguard/dist/public"),
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(__dirname, "../../streamguard/dist/public"),
  path.resolve(__dirname, "../../../streamguard/dist/public"),
];

logger.info({ candidatePaths }, "Checking static frontend asset candidate paths");

const staticDir = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];
const staticExists = fs.existsSync(staticDir);

logger.info({ staticDir, exists: staticExists }, "Selected static assets directory");

if (staticExists) {
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      return next();
    }
    const indexPath = path.join(staticDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      logger.warn({ path: req.path, indexPath }, "Static index.html not found for fallback");
      next();
    }
  });
} else {
  logger.error("No valid static assets directory found. Frontend will not be served!");
}

export default app;
