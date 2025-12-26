/**
 * Test helper that loads calculator.js (browser script) and exports for ES modules
 * This allows us to test the calculator without modifying the original file
 */

const code = await Bun.file(import.meta.dir + "/../../js/calculator.js").text();

// Execute the code and explicitly assign the class to globalThis
new Function(code + "\n; globalThis.MortgageCalculator = MortgageCalculator;")();
const MortgageCalculator = globalThis.MortgageCalculator;

export { MortgageCalculator };
