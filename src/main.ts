import { chromium } from "playwright";
import { slog } from "./slog";
// import { watch } from "chokidar";

(async () => {
  slog.setLevel(slog.LevelDebug);
  slog.info("Starting strudel-server...");

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://strudel.cc");
})();
