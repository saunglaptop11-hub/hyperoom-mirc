import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loginHandler } from "../../api/auth/login.ts";

function localApi() {
  return {
    name: "hyperoom-local-api",
    configureServer(server: any) {
      const env = {
        VITE_SUPABASE_URL: server.config.env.VITE_SUPABASE_URL,
        SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      };
      server.middlewares.use("/api/auth/login", async (req: any, res: any) => {
        if (req.method !== "POST") return;
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks);
        const request = new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        const response = await loginHandler(request, env);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
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
