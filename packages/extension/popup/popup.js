import {
  calculateMortgage,
  recalculateMortgage,
  formatCurrency,
  calculateInterestRateBuydown,
} from "../js/mortgageService";

const RATE_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

document.addEventListener("DOMContentLoaded", async () => {
  // Get DOM elements
  const calcMethodInputs = document.querySelectorAll(
    'input[name="calcMethod"]'
  );
  const priceInput = document.getElementById("price");
  const termSelect = document.getElementById("term");
  const rateInput = document.getElementById("rate");
  const taxInput = document.getElementById("tax");
  const insuranceInput = document.getElementById("insurance");
  const hoaFeeInput = document.getElementById("hoaFee");
  const downPaymentInput = document.getElementById("downPayment");
  const calculateButton = document.getElementById("calculate");
  const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
  const purchasePriceDisplay = document.getElementById("purchasePrice");
  const principalInterestDisplay = document.getElementById("principalInterest");
  const taxesDisplay = document.getElementById("taxes");
  const insuranceAmountDisplay = document.getElementById("insuranceAmount");
  const hoaFeeDisplay = document.getElementById("hoaFeeDisplay");
  const interestRateBuydownSlider = document.getElementById(
    "interestRateBuydown"
  );
  const interestRateBuydownValue = document.getElementById(
    "interestRateBuydownValue"
  );
  const principalBuydownSlider = document.getElementById("principalBuydown");
  const principalBuydownValue = document.getElementById(
    "principalBuydownValue"
  );

  const interestRateBuydownCostDisplay = document.getElementById(
    "interestRateBuydownCost"
  );
  const principalBuydownCostDisplay = document.getElementById(
    "principalBuydownCost"
  );
  const buttonErrorsDisplay = document.getElementById("button-errors");

  // State to track if initial calculation has passed validation
  let hasValidatedInputs = false;
  let lastValidatedInputs = null;
  let currentCalcMethod = "payment";

  // Error display functions
  function showValidationErrors(errors) {
    clearValidationErrors();
    errors.forEach((error) => {
      const errorEl = document.getElementById(`${error.field}-error`);
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.classList.add("visible");
        errorEl.closest(".input-group")?.classList.add("has-error");
      }
    });
    // Also add error state to calculate button and show errors below it
    if (errors.length > 0) {
      calculateButton.classList.add("has-error");
      const fieldLabels = {
        price: "Price/Payment",
        term: "Loan Term",
        rate: "Interest Rate",
        tax: "Property Tax",
        insurance: "Insurance",
        hoaFee: "HOA/Condo Fee",
        principalBuydown: "Principal Buydown",
      };
      const errorList = errors
        .map((e) => `<li>${fieldLabels[e.field] || e.field}: ${e.message}</li>`)
        .join("");
      buttonErrorsDisplay.innerHTML = `<ul>${errorList}</ul>`;
      buttonErrorsDisplay.classList.add("visible");
    }
  }

  function clearValidationErrors() {
    document.querySelectorAll(".error-message").forEach((el) => {
      el.textContent = "";
      el.classList.remove("visible");
    });
    document.querySelectorAll(".input-group.has-error").forEach((el) => {
      el.classList.remove("has-error");
    });
    calculateButton.classList.remove("has-error");
    buttonErrorsDisplay.innerHTML = "";
    buttonErrorsDisplay.classList.remove("visible");
  }

  function clearFieldError(fieldName) {
    const errorEl = document.getElementById(`${fieldName}-error`);
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.remove("visible");
      errorEl.closest(".input-group")?.classList.remove("has-error");
    }
    // Also clear button error state when user starts editing
    calculateButton.classList.remove("has-error");
    buttonErrorsDisplay.innerHTML = "";
    buttonErrorsDisplay.classList.remove("visible");
  }

  // Clear errors on input change
  function setupErrorClearingListeners() {
    priceInput.addEventListener("input", () => clearFieldError("price"));
    termSelect.addEventListener("change", () => clearFieldError("term"));
    rateInput.addEventListener("change", () => clearFieldError("rate"));
    taxInput.addEventListener("change", () => clearFieldError("tax"));
    insuranceInput.addEventListener("input", () =>
      clearFieldError("insurance")
    );
    hoaFeeInput.addEventListener("input", () => clearFieldError("hoaFee"));
  }

  // Initialize error clearing listeners
  setupErrorClearingListeners();

  // Helper function to update display from raw numbers
  function updateDisplayResultsFromRaw(rawData) {
    monthlyPaymentDisplay.textContent = formatCurrency(rawData.monthlyPayment);
    purchasePriceDisplay.textContent = formatCurrency(rawData.purchasePrice);
    principalInterestDisplay.textContent = formatCurrency(
      rawData.principalInterest
    );
    taxesDisplay.textContent = formatCurrency(rawData.taxes);
    insuranceAmountDisplay.textContent = formatCurrency(rawData.insurance);
    hoaFeeDisplay.textContent = formatCurrency(rawData.hoaFee);

    // Update principal buydown slider max value
    updatePrincipalBuydownSliderMax();
  }

  // Helper function to update the principal buydown slider's max value
  function updatePrincipalBuydownSliderMax() {
    const purchasePriceText = purchasePriceDisplay.textContent.replace(
      /[$,]/g,
      ""
    );
    const maxPrincipalBuydown = parseFloat(purchasePriceText) || 0;
    principalBuydownSlider.max =
      maxPrincipalBuydown > 0 ? maxPrincipalBuydown : 0;

    // Also ensure the current value doesn't exceed the new max
    if (parseFloat(principalBuydownSlider.value) > maxPrincipalBuydown) {
      principalBuydownSlider.value = maxPrincipalBuydown;
      // Trigger input event manually if value changes to update displays/recalculate
      principalBuydownSlider.dispatchEvent(new Event("input"));
    }
  }

  // Helper function to update all display results
  function updateDisplayResults(results) {
    monthlyPaymentDisplay.textContent = results.monthlyPayment;
    purchasePriceDisplay.textContent = results.purchasePrice;

    principalInterestDisplay.textContent = results.principalInterest;
    taxesDisplay.textContent = results.taxes;
    insuranceAmountDisplay.textContent = results.insuranceAmount;
    hoaFeeDisplay.textContent = results.hoaFee;

    // Update principal buydown slider max value
    updatePrincipalBuydownSliderMax();
  }

  // Fetch latest NACA rates from Railway API
  const interestRates = await getLatestMortgageRates();

  // Function to update interest rate options based on term
  function updateInterestRateOptions(term) {
    // Clear current options
    rateInput.innerHTML = "";

    // Add new options based on the selected term
    const rates = interestRates[term] || interestRates["30"];
    rates.forEach((rate) => {
      const option = document.createElement("option");
      option.value = rate;
      option.textContent = `${rate}%`;
      rateInput.appendChild(option);
    });

    // Set the higher interest rate (second option) as the default value
    if (rates.length > 1) {
      rateInput.value = rates[1]; // Select the higher rate (second in the array)
    }
    // Update buydown slider after rate is updated
    setTimeout(() => {
      const currentRate = parseFloat(rateInput.value);
      interestRateBuydownSlider.max = currentRate;
      // Enforce max buydown of 1.5%
      const minAllowedRate = Math.max(0, currentRate - 1.5);
      interestRateBuydownSlider.min = minAllowedRate;
      interestRateBuydownSlider.step = "0.001";
      interestRateBuydownSlider.value = currentRate;
      interestRateBuydownValue.textContent = `${currentRate}%`;
      interestRateBuydownCostDisplay.textContent = "$0";
    }, 0);
  }

  // Set default values
  taxInput.value = "15.00";
  insuranceInput.value = "50";
  hoaFeeInput.value = "0";
  downPaymentInput.value = "0";

  // Initialize interest rate options based on default term (30 years)
  updateInterestRateOptions(termSelect.value);

  // Handle term change
  termSelect.addEventListener("change", () => {
    updateInterestRateOptions(termSelect.value);

    // Reset buydown cost display immediately
    interestRateBuydownCostDisplay.textContent = "$0";
    principalBuydownCostDisplay.textContent = "$0";

    // Trigger a recalculation with the new defaults
    // Use a small timeout to ensure rateInput has updated from updateInterestRateOptions
    setTimeout(() => {
      // Use lastValidatedInputs with updated term if available
      if (hasValidatedInputs && lastValidatedInputs) {
        const recalculateInputs = {
          ...lastValidatedInputs,
          term: parseInt(termSelect.value) || 30,
          rate: parseFloat(interestRateBuydownSlider.value) || 0,
        };

        const results = recalculateMortgage(
          recalculateInputs,
          currentCalcMethod
        );
        updateDisplayResultsFromRaw(results);
      }
    }, 50); // Small delay to ensure DOM updates
  });

  // Add event listener for manual rate changes
  rateInput.addEventListener("change", () => {
    const newRate = parseFloat(rateInput.value);

    // Update the buydown slider's max and current value
    interestRateBuydownSlider.max = newRate;
    // Enforce max buydown of 1.5%
    interestRateBuydownSlider.min = Math.max(0, newRate - 1.5);
    interestRateBuydownSlider.step = "0.001";
    interestRateBuydownSlider.value = newRate;
    interestRateBuydownValue.textContent = `${newRate}%`;

    // Reset buydown cost display
    interestRateBuydownCostDisplay.textContent = "$0";
    principalBuydownCostDisplay.textContent = "$0";

    // Recalculate if we have validated inputs
    if (hasValidatedInputs && lastValidatedInputs) {
      const recalculateInputs = {
        ...lastValidatedInputs,
        rate: newRate,
      };

      const results = recalculateMortgage(recalculateInputs, currentCalcMethod);
      updateDisplayResultsFromRaw(results);
    }
  });

  // Handle calculation method change
  calcMethodInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      currentCalcMethod = e.target.value;
      priceInput.placeholder =
        e.target.value === "payment"
          ? "Enter desired monthly payment"
          : "Enter purchase price";

      // Reset validation state when mode changes
      hasValidatedInputs = false;
      lastValidatedInputs = null;

      // Update principal buydown slider max value
      updatePrincipalBuydownSliderMax();
    });
  });

  // Handle calculate button click
  calculateButton.addEventListener("click", () => {
    // Gather raw inputs as strings
    const rawInput = {
      price: priceInput.value,
      term: termSelect.value,
      rate: interestRateBuydownSlider.value, // Use slider value (effective rate)
      tax: taxInput.value,
      insurance: insuranceInput.value,
      hoaFee: hoaFeeInput.value,
      principalBuydown: principalBuydownSlider.value,
    };

    const result = calculateMortgage(rawInput, currentCalcMethod);

    if (!result.ok) {
      showValidationErrors(result.errors);
      return;
    }

    // Clear errors on successful validation
    clearValidationErrors();

    // Store validated inputs for slider recalculations
    hasValidatedInputs = true;
    lastValidatedInputs = {
      price: result.data.purchasePrice, // Use calculated price for payment mode
      term: parseInt(termSelect.value),
      rate: parseFloat(interestRateBuydownSlider.value),
      tax: parseFloat(taxInput.value),
      insurance: parseFloat(insuranceInput.value),
      hoaFee: parseFloat(hoaFeeInput.value),
      principalBuydown: parseFloat(principalBuydownSlider.value),
    };

    // Format and display results
    updateDisplayResultsFromRaw(result.data);
  });

  // Add event listener for the interest rate buydown slider
  interestRateBuydownSlider.addEventListener("input", () => {
    let desiredRate = parseFloat(interestRateBuydownSlider.value);
    const originalRate = parseFloat(rateInput.value);
    const term = parseInt(termSelect.value);
    const purchasePriceText = purchasePriceDisplay.textContent.replace(
      /[$,]/g,
      ""
    );
    const principal = parseFloat(purchasePriceText) || 0;

    if (principal > 0) {
      // Calculate buydown cost via MortgageService (no validation needed)
      const buydownCost = calculateInterestRateBuydown(
        principal,
        originalRate,
        desiredRate,
        term
      );
      interestRateBuydownCostDisplay.textContent = formatCurrency(buydownCost);

      // Apply 1.5% buydown cap and update the displayed percentage
      const minAllowedRate = Math.max(0, originalRate - 1.5);
      let capReached = false;
      if (desiredRate < minAllowedRate) {
        desiredRate = minAllowedRate;
        interestRateBuydownSlider.value = String(minAllowedRate);
        capReached = true;
      }
      interestRateBuydownValue.textContent = capReached
        ? `${desiredRate.toFixed(3)}% (1.5% cap reached)`
        : `${desiredRate.toFixed(3)}%`;

      // Recalculate mortgage using MortgageService with lastValidatedInputs and new rate
      if (hasValidatedInputs && lastValidatedInputs) {
        const recalculateInputs = {
          ...lastValidatedInputs,
          rate: desiredRate,
        };

        const recalculatedResults = recalculateMortgage(
          recalculateInputs,
          currentCalcMethod
        );

        // Update the display based on the calculation method
        if (currentCalcMethod === "price") {
          updateDisplayResultsFromRaw(recalculatedResults);
          purchasePriceDisplay.textContent = formatCurrency(
            recalculateInputs.price
          );
        } else {
          updateDisplayResultsFromRaw(recalculatedResults);
          monthlyPaymentDisplay.textContent = formatCurrency(
            recalculateInputs.price
          );
        }

        // Update principal buydown slider max value after recalculation
        updatePrincipalBuydownSliderMax();
      }
    }
  });

  // Add event listener for the principal buydown slider
  principalBuydownSlider.addEventListener("input", () => {
    const principalBuydown = parseFloat(principalBuydownSlider.value) || 0;
    principalBuydownValue.textContent = formatCurrency(principalBuydown);
    principalBuydownCostDisplay.textContent = formatCurrency(principalBuydown);

    // Use lastValidatedInputs with new principalBuydown
    if (hasValidatedInputs && lastValidatedInputs) {
      const desiredRate = parseFloat(interestRateBuydownSlider.value);
      const term = parseInt(termSelect.value);

      const recalculateInputs = {
        ...lastValidatedInputs,
        principalBuydown: principalBuydown,
      };

      // Recalculate using MortgageService (no validation)
      const recalculatedResults = recalculateMortgage(
        recalculateInputs,
        currentCalcMethod
      );

      // Update the display based on the calculation method
      if (currentCalcMethod === "price") {
        updateDisplayResultsFromRaw(recalculatedResults);
        purchasePriceDisplay.textContent = formatCurrency(
          recalculateInputs.price
        );
      } else {
        updateDisplayResultsFromRaw(recalculatedResults);
        monthlyPaymentDisplay.textContent = formatCurrency(
          recalculateInputs.price
        );
      }

      // Update principal buydown slider max value after recalculation
      updatePrincipalBuydownSliderMax();

      // Also re-calculate and update the interest rate buydown cost via MortgageService
      const originalInterestRate = parseFloat(rateInput.value);
      const currentPurchasePriceText = purchasePriceDisplay.textContent.replace(
        /[$,]/g,
        ""
      );
      const currentPrincipal = parseFloat(currentPurchasePriceText) || 0;
      if (currentPrincipal > 0) {
        const interestBuydownCost = calculateInterestRateBuydown(
          currentPrincipal,
          originalInterestRate,
          desiredRate,
          term
        );
        interestRateBuydownCostDisplay.textContent =
          formatCurrency(interestBuydownCost);
      } else {
        interestRateBuydownCostDisplay.textContent = "$0";
      }
    }
  });

  // Add input validation and formatting
  const numericInputs = [
    priceInput,
    rateInput,
    taxInput,
    insuranceInput,
    hoaFeeInput,
  ];

  numericInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      // Remove non-numeric characters except decimal point
      let value = e.target.value.replace(/[^0-9.]/g, "");

      // Ensure only one decimal point
      const parts = value.split(".");
      if (parts.length > 2) {
        value = parts[0] + "." + parts.slice(1).join("");
      }

      // Update the input value
      e.target.value = value;
    });
  });

  // --- Tab Handling ---
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Deactivate all buttons and hide all content
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // Activate clicked button and show corresponding content
      button.classList.add("active");
      const tabId = button.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });
  });

  // --- MSA Lookup Logic ---
  const addressInput = document.getElementById("address");
  const lookupButton = document.getElementById("lookup-btn");
  const statusDiv = document.getElementById("msaStatus");
  const msaIncomeDisplay = document.getElementById("msaResultMsaIncome");
  const tractIncomeDisplay = document.getElementById("msaResultTractIncome");
  const tractPercentDisplay = document.getElementById("msaResultTractPercent");
  const yearDisplay = document.getElementById("msaResultYear");

  if (lookupButton) {
    lookupButton.addEventListener("click", () => {
      const address = addressInput.value.trim();
      if (!address) {
        statusDiv.textContent = "Please enter an address.";
        return;
      }

      statusDiv.textContent = "Looking up address...";

      // Reset all display fields
      msaIncomeDisplay.textContent = "-";
      tractIncomeDisplay.textContent = "-";
      tractPercentDisplay.textContent = "-";
      yearDisplay.textContent = "-";

      performMsaLookup(address)
        .then((result) => {
          if (result) {
            statusDiv.textContent = `Data found for: ${
              result.address || address
            }`;

            // Update all fields with response data
            msaIncomeDisplay.textContent = `$${
              result.msaMedianFamilyIncome?.toLocaleString() || "N/A"
            }`;
            tractIncomeDisplay.textContent = `$${
              result.tractMedianFamilyIncome?.toLocaleString() || "N/A"
            }`;
            tractPercentDisplay.textContent = `${
              result.tractPercentOfMsa || "N/A"
            }%`;
            yearDisplay.textContent = result.year || "N/A";
          } else {
            statusDiv.textContent = "Could not retrieve data for this address.";
          }
        })
        .catch((error) => {
          statusDiv.textContent = `Error: ${error.message}`;
          console.error("MSA lookup error:", error);
        });
    });
  }
});

// Look up MSA income data from Railway API
async function performMsaLookup(address) {
  const API_BASE_URL =
    "https://naca-mortgage-calc-extension-production.up.railway.app";

  try {
    const response = await fetch(`${API_BASE_URL}/api/msa-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API call failed:", error);
    throw new Error("Failed to fetch income data from the server.");
  }
}

// Fetch latest mortgage rates from Railway API
async function getLatestMortgageRates() {
  const API_BASE_URL =
    "https://naca-mortgage-calc-extension-production.up.railway.app";

  // Check local storage first
  const cachedRates = localStorage.getItem("nacaMortgageRates");
  if (cachedRates) {
    try {
      const { rates, timestamp } = JSON.parse(cachedRates);
      const now = Date.now();
      const cacheAge = now - timestamp;

      // If cache is still valid (less than 24 hours old), return cached rates
      if (cacheAge < RATE_CACHE_EXPIRY_MS) {
        console.log("Using cached mortgage rates");
        return rates;
      }
    } catch (error) {
      console.warn("Failed to parse cached rates:", error);
      localStorage.removeItem("nacaMortgageRates");
    }
  }

  // If no valid cache, fetch fresh rates
  console.log("Fetching fresh mortgage rates from Railway API");
  try {
    const response = await fetch(`${API_BASE_URL}/api/rates`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data) {
      console.warn("No mortgage rate data received from the API.");
      return getDefaultRates();
    }

    // Format and cache the new rates
    const formattedRates = {
      15: [
        parseFloat(data.fifteen_year_rate),
        parseFloat(data.fifteen_year_rate) + 1,
      ],
      20: [
        parseFloat(data.twenty_year_rate),
        parseFloat(data.twenty_year_rate) + 1,
      ],
      30: [
        parseFloat(data.thirty_year_rate),
        parseFloat(data.thirty_year_rate) + 1,
      ],
    };

    // Save to local storage with timestamp
    try {
      localStorage.setItem(
        "nacaMortgageRates",
        JSON.stringify({
          rates: formattedRates,
          timestamp: Date.now(),
        })
      );
      console.log("Mortgage rates cached successfully");
    } catch (error) {
      console.warn("Failed to cache rates:", error);
    }

    return formattedRates;
  } catch (error) {
    console.error("Failed to fetch latest mortgage rates:", error);
    console.warn("Returning default rates due to fetch error.");
    return getDefaultRates();
  }
}

// Helper function to return default rates
function getDefaultRates() {
  return { 15: [5, 6], 20: [5.5, 6.5], 30: [6, 7] };
}
