#!/usr/bin/env bun

/**
 * strudel-server - Simple Playwright-based server with file watching for working on Strudel projects from your favorite text editor.
 */
import { chromium } from "playwright";
import { slog } from "./logging/slog";
import { AnsiCodes } from "./logging/colors";
import { watch } from "chokidar";
import fs from "fs";
import path from "path";

/** URL to Strudel REPL. */
const REPL_URL = "https://strudel.cc";

/**
 * Print usage information and exit.
 * @returns never
 * @throws never
 */
function usage(): never {
  console.log(`
  Usage: bun run src/main.ts ${AnsiCodes.Cyan}[options]${AnsiCodes.Reset} <file>

  <file> is the path to a file to watch for changes.

  Options:
    ${AnsiCodes.Cyan}-h${AnsiCodes.Reset}, ${AnsiCodes.Cyan}--help${AnsiCodes.Reset}       Show this help message and exit
    ${AnsiCodes.Cyan}-v${AnsiCodes.Reset}, ${AnsiCodes.Cyan}-vv${AnsiCodes.Reset}, ${AnsiCodes.Cyan}-vvv${AnsiCodes.Reset}   Set logging verbosity (default: info)

  Examples:
    ${AnsiCodes.Blue}bun run src/main.ts ~/my-project/song.strudel${AnsiCodes.Reset}
    ${AnsiCodes.Blue}bun run src/main.ts -v ~/my-project/song.strudel${AnsiCodes.Reset}
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
  // Handle SIGINT and SIGTERM
  process
    .on("SIGINT", () => {
      slog.info("Received SIGINT, exiting...");
      process.exit(0);
    })
    .on("SIGTERM", () => {
      slog.info("Received SIGTERM, exiting...");
      process.exit(0);
    });

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

  let contents: string | undefined;
  contents = fs.readFileSync(filePath, "utf8");

  slog.info("Starting strudel-server...");
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(REPL_URL);

  // TODO: Start REPL with initial file content

  // Watch for file changes
  const watcher = watch(filePath, { persistent: true, awaitWriteFinish: true });
  watcher
    .on("ready", () => slog.info(`Watching ${filePath}`))
    .on("change", (path) => {
      slog.info("File changed: " + path);

      // Overwrite content in the REPL and re-run
      contents = fs.readFileSync(filePath, "utf8");
      slog.debug("Contents: " + contents);

      // TODO: re-run
    })
    .on("error", (error) => {
      slog.error("Watcher error: " + error);
      process.exit(1);
    });
})();
