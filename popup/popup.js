document.addEventListener("DOMContentLoaded", () => {
  const calculator = new MortgageCalculator();

  // Get DOM elements
  const calcMethodInputs = document.querySelectorAll(
    'input[name="calcMethod"]'
  );
  const priceInput = document.getElementById("price");
  const termSelect = document.getElementById("term");
  const rateInput = document.getElementById("rate");
  const taxInput = document.getElementById("tax");
  const insuranceInput = document.getElementById("insurance");
  const downPaymentInput = document.getElementById("downPayment");
  const calculateButton = document.getElementById("calculate");
  const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
  const purchasePriceDisplay = document.getElementById("purchasePrice");

  // Set default values
  rateInput.value = "5.625";
  taxInput.value = "1.25";
  insuranceInput.value = "50";

  // Handle calculation method change
  calcMethodInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      calculator.setCalcMethod(e.target.value);
      priceInput.placeholder =
        e.target.value === "payment"
          ? "Enter purchase price"
          : "Enter desired monthly payment";
    });
  });

  // Handle calculate button click
  calculateButton.addEventListener("click", () => {
    const inputs = {
      price: priceInput.value,
      term: termSelect.value,
      rate: rateInput.value,
      tax: taxInput.value,
      insurance: insuranceInput.value,
      downPayment: downPaymentInput.value,
    };

    const results = calculator.calculate(inputs);

    monthlyPaymentDisplay.textContent = results.monthlyPayment;
    purchasePriceDisplay.textContent = results.purchasePrice;
  });

  // Add input validation and formatting
  const numericInputs = [
    priceInput,
    rateInput,
    taxInput,
    insuranceInput,
    downPaymentInput,
  ];

  numericInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      // Remove non-numeric characters except decimal point
      e.target.value = e.target.value.replace(/[^0-9.]/g, "");

      // Ensure only one decimal point
      const parts = e.target.value.split(".");
      if (parts.length > 2) {
        e.target.value = parts[0] + "." + parts.slice(1).join("");
      }
    });
  });
});
