#!/usr/bin/env bun

/**
 * Debug script to explore Strudel REPL structure
 */
import { chromium } from "playwright";

const REPL_URL = "https://strudel.cc";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log("Loading Strudel REPL...");
  await page.goto(REPL_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("#code .cm-editor", { timeout: 10000 });
  await page.waitForTimeout(2000);

  console.log("\n=== Debugging CodeMirror structure ===\n");

  const debugInfo = await page.evaluate(() => {
    const info: any = {};

    // Get elements
    const editorElement = document.querySelector("#code .cm-editor");
    const contentElement = document.querySelector("#code .cm-content");

    if (!editorElement) {
      return { error: "Editor element not found" };
    }

    // Check all properties on editor element
    info.editorElementKeys = Object.keys(editorElement).filter(
      (k) => !k.startsWith("on") && k.length < 50,
    );

    // Check for React fiber
    info.reactFiberKeys = Object.keys(editorElement).filter(
      (k) => k.includes("react") || k.includes("fiber") || k.includes("React"),
    );

    // Check window object
    info.windowKeys = Object.keys(window).filter(
      (k) =>
        k.toLowerCase().includes("editor") ||
        k.toLowerCase().includes("codemirror") ||
        k.toLowerCase().includes("cm"),
    );

    // Check if we can access via contentEditable
    info.contentEditable = contentElement?.getAttribute("contenteditable");
    info.textContent = contentElement?.textContent?.substring(0, 100);

    // Try to find any functions that might help
    // @ts-ignore
    info.hasSetCode = typeof window.setCode === "function";
    // @ts-ignore
    info.hasEvaluate = typeof window.evaluate === "function";
    // @ts-ignore
    info.hasRepl = typeof window.repl !== "undefined";

    // Check parent elements
    let parent = editorElement.parentElement;
    let depth = 0;
    const parentChain = [];
    while (parent && depth < 5) {
      parentChain.push({
        tag: parent.tagName,
        id: parent.id,
        classes: Array.from(parent.classList),
        keys: Object.keys(parent).filter(
          (k) =>
            !k.startsWith("on") &&
            k.length < 50 &&
            (k.includes("react") || k.includes("editor") || k.includes("cm")),
        ),
      });
      parent = parent.parentElement;
      depth++;
    }
    info.parentChain = parentChain;

    return info;
  });

  console.log("Debug Info:", JSON.stringify(debugInfo, null, 2));

  console.log("\n\n=== Now testing text insertion methods ===\n");

  // Test if we can insert text directly
  const testContent = "// Test from debug script\nsound('bd sd')";

  const result = await page.evaluate((content) => {
    const contentElement = document.querySelector("#code .cm-content");

    if (
      contentElement &&
      contentElement.getAttribute("contenteditable") === "true"
    ) {
      // Try focus and paste simulation
      if (contentElement instanceof HTMLElement) {
        contentElement.focus();

        // Clear existing content
        const range = document.createRange();
        range.selectNodeContents(contentElement);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
          selection.deleteFromDocument();

          // Insert new content
          const textNode = document.createTextNode(content);
          range.insertNode(textNode);

          // Try to trigger evaluation
          const evalButton = Array.from(
            document.querySelectorAll("button"),
          ).find(
            (btn) =>
              btn.textContent?.toLowerCase().includes("eval") ||
              btn.getAttribute("aria-label")?.toLowerCase().includes("eval"),
          );

          return {
            success: true,
            foundEvalButton: !!evalButton,
            buttonText: evalButton?.textContent,
            buttonAriaLabel: evalButton?.getAttribute("aria-label"),
          };
        }
      }
    }

    return {
      success: false,
      contentEditable: contentElement?.getAttribute("contenteditable"),
    };
  }, testContent);

  console.log("Insertion result:", result);

  console.log("\n\nPress Ctrl+C to close...");

  // Keep browser open for manual inspection
  await new Promise(() => {});
})();
