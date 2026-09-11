import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { loginHandler } from "../../api/auth/login.ts";
import { signupHandler } from "../../api/auth/signup.ts";

function localApi(serverEnv: Record<string, string>) {
  return {
    name: "hyperoom-local-api",
    configureServer(server: any) {
      const env = {
        VITE_SUPABASE_URL: serverEnv.VITE_SUPABASE_URL,
        SUPABASE_SECRET_KEY: serverEnv.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY,
      };
      const fallbackAuthUrl = serverEnv.VITE_AUTH_FALLBACK_URL || "https://hyperoom-mirc.vercel.app";

      async function handleApi(
        handler: (request: Request, env: typeof process.env) => Promise<Response>,
        req: any,
        res: any,
        allowProductionLoginFallback = false,
      ) {
        if (req.method !== "POST") return;
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks);
        if (allowProductionLoginFallback && !env.SUPABASE_SECRET_KEY) {
          const upstream = await fetch(`${fallbackAuthUrl}/api/auth/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          });
          res.statusCode = upstream.status;
          upstream.headers.forEach((value, key) => {
            if (key === "content-encoding" || key === "content-length" || key === "transfer-encoding") return;
            res.setHeader(key, value);
          });
          const upstreamBody = Buffer.from(await upstream.arrayBuffer());
          res.setHeader("content-length", upstreamBody.length);
          res.end(upstreamBody);
          return;
        }
        const request = new Request("http://localhost/api/auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        const response = await handler(request, env);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      }

      server.middlewares.use("/api/auth/login", (req: any, res: any) => handleApi(loginHandler, req, res, true));
      server.middlewares.use("/api/auth/signup", (req: any, res: any) => handleApi(signupHandler, req, res));
    },
  };
}

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, "../..", "");

  const serviceWorker = {
    name: "hyperoom-service-worker",
    closeBundle() {
      copyFileSync(resolve(process.cwd(), "sw.js"), resolve(process.cwd(), "dist/renderer/sw.js"));
    },
  };
  return {
    plugins: [react(), localApi(serverEnv), serviceWorker],
    root: ".",
    envDir: "../..",
    build: {
      outDir: "dist/renderer",
      emptyOutDir: true,
    },
  };
});
