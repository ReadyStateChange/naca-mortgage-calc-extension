import fs from "fs";
import path from "path";

/**
 * Load popup HTML into the DOM (stripping script tags)
 * @returns {void}
 */
export function loadPopupHTML() {
  const htmlPath = path.resolve(import.meta.dir, "../../popup/popup.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  // Extract just the body content (between <body> tags)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let bodyContent = bodyMatch ? bodyMatch[1] : html;
  bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  document.body.innerHTML = bodyContent;
}

/**
 * Load popup CSS into the DOM
 * @returns {void}
 */
export function loadPopupCSS() {
  const cssPath = path.resolve(import.meta.dir, "../../popup/popup.css");
  const css = fs.readFileSync(cssPath, "utf8");

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Get mock rates in Railway API response format
 * @returns {Object} Mock rates data in API format
 */
export function getMockApiRates() {
  return {
    fifteen_year_rate: 5.625,
    twenty_year_rate: 5.875,
    thirty_year_rate: 6.125
  };
}

/**
 * Get formatted mock rates (as used by popup.js after processing)
 * @returns {Object} Formatted rates
 */
export function getMockRates() {
  return {
    "15": [5.625, 6.625],
    "20": [5.875, 6.875],
    "30": [6.125, 7.125]
  };
}

/**
 * Setup mock fetch for rates API
 * @param {Object} mockApiRates - Rates in API format to return
 */
export function mockFetch(mockApiRates = getMockApiRates()) {
  globalThis.fetch = async (url, options) => {
    if (url.includes("/api/rates")) {
      return {
        ok: true,
        json: async () => mockApiRates
      };
    }
    if (url.includes("/api/msa-lookup")) {
      return {
        ok: true,
        json: async () => ({
          address: "123 Test St",
          msaMedianFamilyIncome: 80000,
          tractMedianFamilyIncome: 75000,
          tractPercentOfMsa: 93.75,
          year: 2024
        })
      };
    }
    throw new Error(`Unmocked fetch: ${url}`);
  };
}

/**
 * Clear localStorage (used for rate caching)
 */
export function clearLocalStorage() {
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
}

/**
 * Reset DOM and mocks between tests
 */
export function resetTestEnvironment() {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  clearLocalStorage();
}

// Store the original module cache state
let popupModuleLoaded = false;

/**
 * Initialize popup.js by dynamically importing and triggering DOMContentLoaded
 * This allows tests to import popup.js as an ES module
 * @returns {Promise<void>}
 */
export async function initializePopup() {
  await import("../../popup/popup.js");

  const event = new Event("DOMContentLoaded", {
    bubbles: true,
    cancelable: true
  });
  document.dispatchEvent(event);

  await new Promise(resolve => setTimeout(resolve, 300));
}
