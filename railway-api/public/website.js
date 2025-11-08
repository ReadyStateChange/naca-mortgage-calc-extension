document.addEventListener("DOMContentLoaded", async () => {
  const calculator = new MortgageCalculator();

  // Elements
  const calcMethodInputs = document.querySelectorAll(
    'input[name="calcMethod"]',
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
    "interestRateBuydown",
  );
  const interestRateBuydownValue = document.getElementById(
    "interestRateBuydownValue",
  );
  const principalBuydownSlider = document.getElementById("principalBuydown");
  const principalBuydownValue = document.getElementById(
    "principalBuydownValue",
  );
  const interestRateBuydownCostDisplay = document.getElementById(
    "interestRateBuydownCost",
  );
  const principalBuydownCostDisplay = document.getElementById(
    "principalBuydownCost",
  );

  // MSA Lookup elements
  const addressInput = document.getElementById("address");
  const lookupButton = document.getElementById("lookup-btn");
  const statusDiv = document.getElementById("msaStatus");
  const msaIncomeDisplay = document.getElementById("msaResultMsaIncome");
  const tractIncomeDisplay = document.getElementById("msaResultTractIncome");
  const tractPercentDisplay = document.getElementById("msaResultTractPercent");
  const yearDisplay = document.getElementById("msaResultYear");

  function updatePrincipalBuydownSliderMax() {
    const purchasePriceText = purchasePriceDisplay.textContent.replace(
      /[$,]/g,
      "",
    );
    const maxPrincipalBuydown = parseFloat(purchasePriceText) || 0;
    principalBuydownSlider.max = maxPrincipalBuydown > 0
      ? maxPrincipalBuydown
      : 0;
    if (parseFloat(principalBuydownSlider.value) > maxPrincipalBuydown) {
      principalBuydownSlider.value = maxPrincipalBuydown;
      principalBuydownSlider.dispatchEvent(new Event("input"));
    }
  }

  // Fetch latest NACA rates from Railway API
  const interestRates = await getLatestMortgageRates();

  function updateInterestRateOptions(term) {
    rateInput.innerHTML = "";
    const rates = interestRates[term] || interestRates["30"];
    rates.forEach((rate) => {
      const option = document.createElement("option");
      option.value = rate;
      option.textContent = `${rate}%`;
      rateInput.appendChild(option);
    });
    if (rates.length > 1) {
      rateInput.value = rates[1];
    }
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

  // Defaults
  taxInput.value = "15.00";
  insuranceInput.value = "50";
  hoaFeeInput.value = "0";
  downPaymentInput.value = "0";

  updateInterestRateOptions(termSelect.value);

  termSelect.addEventListener("change", () => {
    updateInterestRateOptions(termSelect.value);
    interestRateBuydownCostDisplay.textContent = "$0";
    principalBuydownCostDisplay.textContent = "$0";
    setTimeout(() => {
      const inputs = {
        price: parseFloat(priceInput.value) || 0,
        term: parseInt(termSelect.value) || 30,
        rate: parseFloat(interestRateBuydownSlider.value) || 0,
        tax: parseFloat(taxInput.value) || 0,
        insurance: parseFloat(insuranceInput.value) || 0,
        hoaFee: parseFloat(hoaFeeInput.value) || 0,
        principalBuydown: parseFloat(principalBuydownSlider.value) || 0,
      };
      const results = calculator.calculate(inputs);
      monthlyPaymentDisplay.textContent = results.monthlyPayment;
      purchasePriceDisplay.textContent = results.purchasePrice;
      principalInterestDisplay.textContent = results.principalInterest;
      taxesDisplay.textContent = results.taxes;
      insuranceAmountDisplay.textContent = results.insuranceAmount;
      hoaFeeDisplay.textContent = results.hoaFee;
      updatePrincipalBuydownSliderMax();
    }, 50);
  });

  rateInput.addEventListener("change", () => {
    const newRate = parseFloat(rateInput.value);
    interestRateBuydownSlider.max = newRate;
    // Enforce max buydown of 1.5%
    interestRateBuydownSlider.min = Math.max(0, newRate - 1.5);
    interestRateBuydownSlider.step = "0.001";
    interestRateBuydownSlider.value = newRate;
    interestRateBuydownValue.textContent = `${newRate}%`;
    interestRateBuydownCostDisplay.textContent = "$0";
    principalBuydownCostDisplay.textContent = "$0";
    const inputs = {
      price: parseFloat(priceInput.value) || 0,
      term: parseInt(termSelect.value) || 30,
      rate: newRate,
      tax: parseFloat(taxInput.value) || 0,
      insurance: parseFloat(insuranceInput.value) || 0,
      hoaFee: parseFloat(hoaFeeInput.value) || 0,
      principalBuydown: parseFloat(principalBuydownSlider.value) || 0,
    };
    const results = calculator.calculate(inputs);
    monthlyPaymentDisplay.textContent = results.monthlyPayment;
    purchasePriceDisplay.textContent = results.purchasePrice;
    principalInterestDisplay.textContent = results.principalInterest;
    taxesDisplay.textContent = results.taxes;
    insuranceAmountDisplay.textContent = results.insuranceAmount;
    hoaFeeDisplay.textContent = results.hoaFee;
    updatePrincipalBuydownSliderMax();
  });

  calcMethodInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      calculator.setCalcMethod(e.target.value);
      priceInput.placeholder = e.target.value === "payment"
        ? "Enter desired monthly payment"
        : "Enter purchase price";
      updatePrincipalBuydownSliderMax();
    });
  });

  calculateButton.addEventListener("click", () => {
    const inputs = {
      price: parseFloat(priceInput.value) || 0,
      term: parseInt(termSelect.value) || 30,
      rate: parseFloat(interestRateBuydownSlider.value) || 0,
      tax: parseFloat(taxInput.value) || 0,
      insurance: parseFloat(insuranceInput.value) || 0,
      hoaFee: parseFloat(hoaFeeInput.value) || 0,
      principalBuydown: parseFloat(principalBuydownSlider.value) || 0,
    };
    const results = calculator.calculate(inputs);
    monthlyPaymentDisplay.textContent = results.monthlyPayment;
    purchasePriceDisplay.textContent = results.purchasePrice;
    principalInterestDisplay.textContent = results.principalInterest;
    taxesDisplay.textContent = results.taxes;
    insuranceAmountDisplay.textContent = results.insuranceAmount;
    hoaFeeDisplay.textContent = results.hoaFee;
    updatePrincipalBuydownSliderMax();
  });

  interestRateBuydownSlider.addEventListener("input", () => {
    let desiredRate = parseFloat(interestRateBuydownSlider.value);
    const originalRate = parseFloat(rateInput.value);
    const term = parseInt(termSelect.value);
    const purchasePriceText = purchasePriceDisplay.textContent.replace(
      /[$,]/g,
      "",
    );
    const principal = parseFloat(purchasePriceText) || 0;
    if (principal > 0) {
      let buydownCost = 0;
      const currentPurchasePriceText = purchasePriceDisplay.textContent.replace(
        /[$,]/g,
        "",
      );
      const currentPrincipal = parseFloat(currentPurchasePriceText) || 0;
      if (currentPrincipal > 0) {
        buydownCost = calculator.calculateInterestRateBuydown(
          currentPrincipal,
          originalRate,
          desiredRate,
          term,
        );
        interestRateBuydownCostDisplay.textContent = calculator.formatNumber(
          buydownCost,
        );
      } else {
        interestRateBuydownCostDisplay.textContent = "$0";
      }
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

      const tax = parseFloat(taxInput.value) || 0;
      const insurance = parseFloat(insuranceInput.value) || 0;
      const hoaFee = parseFloat(hoaFeeInput.value) || 0;
      const principalBuydown = parseFloat(principalBuydownSlider.value) || 0;
      const recalculateInputs = {
        term: term,
        rate: desiredRate,
        tax: tax,
        insurance: insurance,
        hoaFee: hoaFee,
        price: parseFloat(priceInput.value) || 0,
        principalBuydown: principalBuydown,
      };
      const recalculatedResults = calculator.calculate(recalculateInputs);
      if (calculator.calcMethod === "price") {
        monthlyPaymentDisplay.textContent = recalculatedResults.monthlyPayment;
        principalInterestDisplay.textContent =
          recalculatedResults.principalInterest;
        taxesDisplay.textContent = recalculatedResults.taxes;
        insuranceAmountDisplay.textContent =
          recalculatedResults.insuranceAmount;
        hoaFeeDisplay.textContent = recalculatedResults.hoaFee;
        purchasePriceDisplay.textContent = calculator.formatNumber(
          recalculateInputs.price,
        );
      } else {
        purchasePriceDisplay.textContent = recalculatedResults.purchasePrice;
        principalInterestDisplay.textContent =
          recalculatedResults.principalInterest;
        taxesDisplay.textContent = recalculatedResults.taxes;
        insuranceAmountDisplay.textContent =
          recalculatedResults.insuranceAmount;
        hoaFeeDisplay.textContent = recalculatedResults.hoaFee;
        monthlyPaymentDisplay.textContent = calculator.formatNumber(
          recalculateInputs.price,
        );
      }
      updatePrincipalBuydownSliderMax();
    }
  });

  principalBuydownSlider.addEventListener("input", () => {
    const principalBuydown = parseFloat(principalBuydownSlider.value) || 0;
    principalBuydownValue.textContent = calculator.formatNumber(
      principalBuydown,
    );
    principalBuydownCostDisplay.textContent = calculator.formatNumber(
      principalBuydown,
    );

    const term = parseInt(termSelect.value);
    const desiredRate = parseFloat(interestRateBuydownSlider.value);
    const tax = parseFloat(taxInput.value) || 0;
    const insurance = parseFloat(insuranceInput.value) || 0;
    const hoaFee = parseFloat(hoaFeeInput.value) || 0;
    const recalculateInputs = {
      term: term,
      rate: desiredRate,
      tax: tax,
      insurance: insurance,
      hoaFee: hoaFee,
      price: parseFloat(priceInput.value) || 0,
      principalBuydown: principalBuydown,
    };
    const recalculatedResults = calculator.calculate(recalculateInputs);
    if (calculator.calcMethod === "price") {
      monthlyPaymentDisplay.textContent = recalculatedResults.monthlyPayment;
      principalInterestDisplay.textContent =
        recalculatedResults.principalInterest;
      taxesDisplay.textContent = recalculatedResults.taxes;
      insuranceAmountDisplay.textContent = recalculatedResults.insuranceAmount;
      hoaFeeDisplay.textContent = recalculatedResults.hoaFee;
      purchasePriceDisplay.textContent = calculator.formatNumber(
        recalculateInputs.price,
      );
    } else {
      purchasePriceDisplay.textContent = recalculatedResults.purchasePrice;
      principalInterestDisplay.textContent =
        recalculatedResults.principalInterest;
      taxesDisplay.textContent = recalculatedResults.taxes;
      insuranceAmountDisplay.textContent = recalculatedResults.insuranceAmount;
      hoaFeeDisplay.textContent = recalculatedResults.hoaFee;
      monthlyPaymentDisplay.textContent = calculator.formatNumber(
        recalculateInputs.price,
      );
    }

    const originalInterestRate = parseFloat(rateInput.value);
    const currentPurchasePriceText = purchasePriceDisplay.textContent.replace(
      /[$,]/g,
      "",
    );
    const currentPrincipal = parseFloat(currentPurchasePriceText) || 0;
    if (currentPrincipal > 0) {
      const interestBuydownCost = calculator.calculateInterestRateBuydown(
        currentPrincipal,
        originalInterestRate,
        desiredRate,
        term,
      );
      interestRateBuydownCostDisplay.textContent = calculator.formatNumber(
        interestBuydownCost,
      );
    } else {
      interestRateBuydownCostDisplay.textContent = "$0";
    }
    updatePrincipalBuydownSliderMax();
  });

  const numericInputs = [
    priceInput,
    rateInput,
    taxInput,
    insuranceInput,
    hoaFeeInput,
  ];
  numericInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      let value = e.target.value.replace(/[^0-9.]/g, "");
      const parts = value.split(".");
      if (parts.length > 2) {
        value = parts[0] + "." + parts.slice(1).join("");
      }
      e.target.value = value;
    });
  });

  // --- MSA Lookup Logic ---
  if (lookupButton) {
    lookupButton.addEventListener("click", () => {
      const address = addressInput.value.trim();
      if (!address) {
        statusDiv.textContent = "Please enter an address.";
        return;
      }

      statusDiv.textContent = "Looking up address...";

      // Reset displays
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

// Fetch latest mortgage rates from Railway API
async function getLatestMortgageRates() {
  try {
    const response = await fetch(
      `/api/rates`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }
    const data = await response.json();
    if (!data) {
      // Default to 7% selected across terms if no data is returned
      return { "15": [6, 7], "20": [6, 7], "30": [6, 7] };
    }
    return {
      "15": [data.fifteen_year_rate, data.fifteen_year_rate + 1],
      "20": [data.twenty_year_rate, data.twenty_year_rate + 1],
      "30": [data.thirty_year_rate, data.thirty_year_rate + 1],
    };
  } catch (error) {
    console.error("Failed to fetch latest mortgage rates:", error);
    // Default to 7% selected across terms if the request fails
    return { "15": [6, 7], "20": [6, 7], "30": [6, 7] };
  }
}

// Look up MSA income data from Railway API
async function performMsaLookup(address) {
  try {
    const response = await fetch(
      `/api/msa-lookup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API call failed:", error);
    throw new Error("Failed to fetch income data from the server.");
  }
}
