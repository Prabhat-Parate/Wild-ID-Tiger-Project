import path from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
    headless: true,
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--use-file-for-fake-video-capture=" +
          path.resolve("tests/fixtures/tiger-camera.y4m"),
      ],
    },
    viewport: { width: 1440, height: 1000 },
  },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          process.env.PLAYWRIGHT_REPORT || "docs/playwright-results.json",
      },
    ],
  ],
});
