#!/usr/bin/env bun

/**
 * strudel-server - Simple Playwright-based server with file watching for working on Strudel projects from your favorite text editor.
 */
import { chromium, type Page } from "playwright";
import { slog } from "./logging/slog";
import { AnsiCodes } from "./logging/colors";
import fs from "fs";
import path from "path";

/** URL to Strudel REPL. */
const REPL_URL = "https://strudel.cc";

/**
 * Update the Strudel REPL CodeMirror editor with new content and trigger evaluation.
 * Accesses CodeMirror EditorView through React fiber internals.
 * @param page Playwright page instance
 * @param content New content to set in the editor
 */
async function updateREPLContext(page: Page, content: string) {
  try {
    // Wait for CodeMirror content to be available
    await page.waitForSelector("#code .cm-content[contenteditable='true']", {
      timeout: 10000,
    });

    // Access CodeMirror view via multiple methods and update content
    const result = await page.evaluate((newContent) => {
      // Find the editor element
      const editorElement = document.querySelector("#code .cm-editor") as any;
      if (!editorElement) {
        throw new Error("CodeMirror editor element not found");
      }

      let editorView = null;

      // Method 1: Check CodeMirror 6's standard property
      // CodeMirror 6 stores the view on the dom property
      if (editorElement.CodeMirror) {
        editorView = editorElement.CodeMirror;
      }

      // Method 2: Try to get view from contentDOM
      const contentElement = document.querySelector("#code .cm-content") as any;
      if (!editorView && contentElement) {
        // Walk up from content to find the view
        let el = contentElement;
        while (el && el !== document.body) {
          if (el.cmView) {
            editorView = el.cmView.view;
            break;
          }
          el = el.parentElement;
        }
      }

      // Method 3: Check all properties on the editor element
      if (!editorView) {
        const allKeys = Object.keys(editorElement);
        for (const key of allKeys) {
          const value = editorElement[key];
          if (
            value &&
            typeof value === "object" &&
            value.state &&
            value.dispatch &&
            typeof value.dispatch === "function"
          ) {
            editorView = value;
            break;
          }
        }
      }

      // Method 4: Check React fiber tree
      if (!editorView) {
        const fiberKeys = Object.keys(editorElement).filter(
          (key) =>
            key.startsWith("__react") ||
            key.startsWith("_react") ||
            key.includes("Fiber") ||
            key.includes("Internal"),
        );

        for (const key of fiberKeys) {
          const fiber = editorElement[key];
          if (!fiber) continue;

          let current = fiber;
          let depth = 0;
          while (current && depth < 30) {
            if (current.memoizedProps?.view?.state?.doc) {
              editorView = current.memoizedProps.view;
              break;
            }
            if (current.memoizedState?.view?.state?.doc) {
              editorView = current.memoizedState.view;
              break;
            }
            if (current.stateNode?.view?.state?.doc) {
              editorView = current.stateNode.view;
              break;
            }
            current = current.return;
            depth++;
          }
          if (editorView) break;
        }
      }

      // Method 5: Search through all elements for anything with EditorView signature
      if (!editorView) {
        const code = document.querySelector("#code") as any;
        if (code) {
          const search = (obj: any, maxDepth = 3, currentDepth = 0): any => {
            if (currentDepth > maxDepth || !obj || typeof obj !== "object")
              return null;
            if (obj.state && obj.dispatch && obj.state.doc) return obj;
            for (const key in obj) {
              if (key.startsWith("_") || key.startsWith("$")) continue;
              const result = search(obj[key], maxDepth, currentDepth + 1);
              if (result) return result;
            }
            return null;
          };
          editorView = search(code);
        }
      }

      if (!editorView || !editorView.state || !editorView.dispatch) {
        // Last resort: try to manually trigger change via contenteditable
        const contentEl = document.querySelector(
          "#code .cm-content",
        ) as HTMLElement;
        if (contentEl && contentEl.isContentEditable) {
          contentEl.focus();
          contentEl.textContent = newContent;
          // Dispatch input event to trigger CodeMirror update
          contentEl.dispatchEvent(new Event("input", { bubbles: true }));
          return {
            success: true,
            method: "contenteditable",
            docLength: newContent.length,
          };
        }

        throw new Error(
          "CodeMirror EditorView not accessible via any known method",
        );
      }

      // Replace entire document content using CodeMirror API
      const transaction = editorView.state.update({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: newContent,
        },
      });

      editorView.dispatch(transaction);

      return {
        success: true,
        method: "api",
        docLength: editorView.state.doc.length,
      };
    }, content);

    slog.debug(
      `Content updated via ${result.method}, new doc length: ${result.docLength}`,
    );

    // Wait a moment for CodeMirror to process
    await page.waitForTimeout(100);

    // Trigger evaluation by finding and clicking the play/evaluate button
    const evaluated = await page.evaluate(() => {
      // Look for the play/evaluate button
      // Try various selectors that might match the evaluate button
      const selectors = [
        'button[title*="evaluate" i]',
        'button[aria-label*="evaluate" i]',
        'button[title*="ctrl+enter" i]',
        'button:has(svg):has-text("play")',
        'button svg[class*="play"]',
        '[role="button"][title*="evaluate" i]',
      ];

      for (const selector of selectors) {
        try {
          const button = document.querySelector(selector);
          if (button instanceof HTMLElement) {
            button.click();
            return { success: true, selector };
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Fallback: look for any button with play-related content
      const allButtons = Array.from(document.querySelectorAll("button"));
      for (const button of allButtons) {
        const text = (button.textContent || "").toLowerCase();
        const title = (button.getAttribute("title") || "").toLowerCase();
        const ariaLabel = (
          button.getAttribute("aria-label") || ""
        ).toLowerCase();

        if (
          text.includes("play") ||
          text.includes("eval") ||
          title.includes("play") ||
          title.includes("eval") ||
          title.includes("ctrl") ||
          ariaLabel.includes("play") ||
          ariaLabel.includes("eval")
        ) {
          button.click();
          return { success: true, selector: "text-based-search" };
        }
      }

      return { success: false };
    });

    if (evaluated.success) {
      slog.debug(`Evaluation triggered via ${evaluated.selector}`);
    } else {
      slog.warn("Could not find evaluate button, trying keyboard shortcut");
      // Fallback to keyboard shortcut
      await page.click("#code .cm-content");
      await page.keyboard.press("Control+Enter");
    }
  } catch (error) {
    slog.error("Failed to update REPL: " + error);
    throw error;
  }
}

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
    const arg = args[i];
    if (!arg) continue;

    if (arg === "-h" || arg === "--help") {
      usage();
    } else if (arg.startsWith("-v")) {
      const vCount = arg.match(/^-v+$/)?.[0].length ?? 0;
      verbosity = slog.LevelInfo - vCount;
    } else if (!file) {
      file = arg;
    } else {
      console.log("Unknown argument: " + arg);
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
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let watcher: fs.FSWatcher | null = null;

  // Handle SIGINT and SIGTERM for graceful shutdown
  const cleanup = async () => {
    slog.info("Shutting down gracefully...");
    if (watcher) {
      watcher.close();
    }
    if (browser) {
      await browser.close();
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup).on("SIGTERM", cleanup);

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

  // Read initial file content
  let contents: string = fs.readFileSync(filePath, "utf8");

  slog.info("Starting strudel-server...");
  browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to Strudel REPL
  slog.info("Loading Strudel REPL...");

  // Use domcontentloaded instead of networkidle (faster, more reliable)
  await page.goto(REPL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait for the Astro island to hydrate and CodeMirror to be ready
  slog.info("Waiting for editor to initialize...");
  await page.waitForSelector("#code .cm-content[contenteditable='true']", {
    timeout: 30000,
  });

  // Additional wait for React hydration to complete
  await page.waitForTimeout(2000);

  // Load initial file content into REPL
  slog.info("Loading initial content into REPL...");
  try {
    await updateREPLContext(page, contents);
    slog.info("Initial content loaded successfully");
  } catch (error) {
    slog.error("Failed to load initial content: " + error);
    await cleanup();
    process.exit(1);
  }

  // Watch for file changes using native fs.watch (efficient, OS-level watching)
  // Watch the parent directory because Neovim uses atomic writes (write to temp, then rename)
  const watchDir = path.dirname(filePath);
  const watchFilename = path.basename(filePath);

  slog.info(`Watching ${filePath} for changes...`);

  // Track last modification time to debounce rapid changes
  let lastMtime = fs.statSync(filePath).mtimeMs;
  let updateTimeout: Timer | null = null;

  watcher = fs.watch(
    watchDir,
    { persistent: true, recursive: false },
    async (eventType, filename) => {
      // Only process events for our target file
      if (filename !== watchFilename) {
        return;
      }

      slog.debug(`File event: ${eventType} for ${filename}`);

      // Debounce: wait for file writes to settle
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }

      updateTimeout = setTimeout(async () => {
        try {
          // Check if file still exists (it should after Neovim's atomic write)
          if (!fs.existsSync(filePath)) {
            slog.debug(
              "File temporarily doesn't exist (atomic write in progress)",
            );
            return;
          }

          const stats = fs.statSync(filePath);

          // Only update if file was actually modified
          if (stats.mtimeMs === lastMtime) {
            return;
          }
          lastMtime = stats.mtimeMs;

          slog.info("File changed, reloading REPL...");

          // Read updated content
          contents = fs.readFileSync(filePath, "utf8");
          slog.debug("New contents: " + contents.slice(0, 100) + "...");

          // Update REPL and trigger evaluation
          await updateREPLContext(page, contents);
          slog.info("REPL updated successfully");
        } catch (error) {
          slog.error("Error updating REPL: " + error);
        }
      }, 150); // 150ms debounce for Neovim's atomic writes
    },
  );

  watcher.on("error", (error) => {
    slog.error("Watcher error: " + error);
    cleanup();
  });

  slog.info(
    "strudel-server is ready! Edit your file in your code editor and watch the changes.",
  );
})();
