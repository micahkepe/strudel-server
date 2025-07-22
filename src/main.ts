/**
 * strudel-server - Simple Playwright-based server with file watching for working on Strudel projects from your favorite text editor.
 */
import { chromium } from "playwright";
import { slog } from "./logging/slog";
import { watch } from "chokidar";
import fs from "fs";
import path from "path";

/** URL to Strudel REPL. */
const REPL_URL = "https://strudel.cc/repl";

/**
 * Print usage information and exit.
 * @returns never
 * @throws never
 */
function usage(): never {
  console.log(`
  Usage: bun run src/main.ts [options] <file>
  Options:
    -h, --help       Show this help message and exit
    -v, -vv, -vvv    Set logging verbosity (default: info)
  `);

  // Exit process
  process.exit(0);
}

/**
 * Parse command line arguments.
 */
interface ParsedArgs {
  /** File to watch for changes. */
  file: string;
  /** Logging verbosity. */
  verbosity: number;
}

/**
 * Parse command line arguments.
 * @param args command line arguments from process.argv
 * @returns parsed arguments as an object
 */
function parseArgs(args: string[]): ParsedArgs {
  let file: string | null = null;
  let verbosity: number = slog.LevelInfo;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-h" || args[i] === "--help") {
      usage();
    } else if (args[i].startsWith("-v")) {
      const vCount = args[i].match(/^-v+$/)?.[0].length ?? 0;
      verbosity = slog.LevelInfo - vCount;
    } else if (!file) {
      file = args[i];
    } else {
      console.log("Unknown argument: " + args[i]);
      usage();
    }
  }

  if (!file) {
    console.log("No file specified.");
    usage();
  }

  return { file, verbosity };
}

/**
 * Run the server.
 */
(async () => {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let parsedArgs: ParsedArgs = parseArgs(args);
  slog.setLevel(parsedArgs.verbosity);

  slog.debug("Parsed args:", ["args", parsedArgs]);

  // Verify file exists
  const filePath = path.resolve(parsedArgs.file);
  if (!fs.existsSync(filePath)) {
    slog.error("File does not exist: " + filePath);
    process.exit(1);
  } else if (!fs.lstatSync(filePath).isFile()) {
    slog.error("File is not a file: " + filePath);
    process.exit(1);
  }

  slog.info("Starting strudel-server...");
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(REPL_URL);

  // Watch for file changes
  const watcher = watch(filePath, { persistent: true });
  watcher
    .on("ready", () => slog.info(`Watching ${filePath}`))
    .on("change", (path) => {
      slog.info("File changed: " + path);

      // TODO: copy file contents to REPL and run
    })
    .on("error", (error) => {
      slog.error("Watcher error: " + error);
      process.exit(1);
    });
})();
