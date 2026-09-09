import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loginHandler } from "../../api/auth/login.ts";
import { signupHandler } from "../../api/auth/signup.ts";

function localApi() {
  return {
    name: "hyperoom-local-api",
    configureServer(server: any) {
      const env = {
        VITE_SUPABASE_URL: server.config.env.VITE_SUPABASE_URL,
        SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      };
      async function handleApi(handler: (request: Request, env: typeof process.env) => Promise<Response>, req: any, res: any) {
        if (req.method !== "POST") return;
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const request = new Request("http://localhost/api/auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: Buffer.concat(chunks),
        });
        const response = await handler(request, env);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      }
      server.middlewares.use("/api/auth/login", (req: any, res: any) => handleApi(loginHandler, req, res));
      server.middlewares.use("/api/auth/signup", (req: any, res: any) => handleApi(signupHandler, req, res));
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  root: ".",
  envDir: "../..",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
  },
});
