import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app } from "./app";
import * as ai from "./ai";

const here = path.dirname(fileURLToPath(import.meta.url));

// ---- статика в продакшене ----
const dist = path.resolve(here, "../dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Atelier API → http://localhost:${port}  (ИИ: ${ai.aiAvailable() ? ai.MODEL : "выключен — нет ANTHROPIC_API_KEY"})`);
});
