import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: process.env.CINEMA_CHROMIUM_PATH
      ? {
          executablePath: process.env.CINEMA_CHROMIUM_PATH,
          args: [
            "--no-sandbox",
            "--no-zygote",
            "--single-process",
            "--disable-webgl",
          ],
        }
      : {},
    viewport: { width: 1920, height: 1080 },
  },
  webServer: {
    command: "npm run dev -- --port 5173 --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  reporter: "list",
});
