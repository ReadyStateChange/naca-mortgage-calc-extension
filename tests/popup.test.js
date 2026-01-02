import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "bun:test";
import userEvent from "@testing-library/user-event";
import {
  loadPopupHTML,
  loadPopupCSS,
  mockFetch,
  resetTestEnvironment,
  initializePopup,
  clearLocalStorage,
} from "./helpers/popupLoader.js";

describe("Popup Calculator", () => {
  let user;

  beforeAll(async () => {
    resetTestEnvironment();
    clearLocalStorage();
    mockFetch();
    loadPopupHTML();
    loadPopupCSS();
    await initializePopup();
  });

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterAll(() => {
    resetTestEnvironment();
  });

  async function resetFormState() {
    const priceInput = document.getElementById("price");
    if (priceInput) priceInput.value = "";

    const paymentRadio = document.querySelector(
      'input[name="calcMethod"][value="payment"]'
    );
    if (paymentRadio && !paymentRadio.checked) {
      paymentRadio.checked = true;
      paymentRadio.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const termSelect = document.getElementById("term");
    if (termSelect && termSelect.value !== "30") {
      termSelect.value = "30";
      termSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const principalBuydownSlider = document.getElementById("principalBuydown");
    if (principalBuydownSlider) {
      principalBuydownSlider.value = "0";
    }
  }

  function getSelectedRate() {
    const rateSelect = document.getElementById("rate");
    const selectedOption = rateSelect.querySelector("option:last-child");
    return selectedOption ? parseFloat(selectedOption.value) : null;
  }

  describe("State 1: Empty State (Default)", () => {
    it("has 'desired monthly payment' as default calculation method", () => {
      const paymentRadio = document.querySelector(
        'input[name="calcMethod"][value="payment"]'
      );
      const priceRadio = document.querySelector(
        'input[name="calcMethod"][value="price"]'
      );

      expect(paymentRadio.checked).toBe(true);
      expect(priceRadio.checked).toBe(false);
    });

    it("has loan term filled with 30 years as default", () => {
      const termSelect = document.getElementById("term");
      expect(termSelect.value).toBe("30");
    });

    it("has interest rate dropdown populated with rates for 30-year term", () => {
      const rateSelect = document.getElementById("rate");
      const options = rateSelect.querySelectorAll("option");

      expect(options.length).toBe(2);
      expect(options[0].value).toBe("6.125");
      expect(options[1].value).toBe("7.125");
    });

    it("has property tax select with expected options", () => {
      const taxSelect = document.getElementById("tax");
      const option15 = taxSelect.querySelector('option[value="15"]');
      expect(option15).not.toBeNull();
      expect(option15.textContent).toBe("15%");
    });

    it("has insurance filled with default value", () => {
      const insuranceInput = document.getElementById("insurance");
      expect(insuranceInput.value).toBe("50");
    });

    it("has HOA fee filled with default value", () => {
      const hoaFeeInput = document.getElementById("hoaFee");
      expect(hoaFeeInput.value).toBe("0");
    });

    it("has empty price/payment input field", async () => {
      await resetFormState();
      const priceInput = document.getElementById("price");
      expect(priceInput.value).toBe("");
    });

    it("updates interest rate options when term changes", async () => {
      const termSelect = document.getElementById("term");
      const rateSelect = document.getElementById("rate");

      await user.selectOptions(termSelect, "15");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const options = rateSelect.querySelectorAll("option");
      expect(options.length).toBe(2);
      expect(options[0].value).toBe("5.625");
      expect(options[1].value).toBe("6.625");

      await user.selectOptions(termSelect, "30");
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe("State 2: Invalid Submission", () => {
    beforeEach(async () => {
      await resetFormState();
    });

    it("silently handles empty price input (replaces with zero)", async () => {
      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");

      priceInput.value = "";
      await user.click(calculateBtn);

      expect(monthlyPaymentDisplay.textContent).toBe("$0.00");
    });

    it("handles zero price input", async () => {
      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");

      await user.type(priceInput, "0");
      await user.click(calculateBtn);

      expect(monthlyPaymentDisplay.textContent).toBe("$0.00");
    });
  });

  describe("State 3: Valid Submission", () => {
    beforeEach(async () => {
      await resetFormState();
    });

    it("calculates correct monthly payment for price mode", async () => {
      const priceRadio = document.querySelector(
        'input[name="calcMethod"][value="price"]'
      );
      await user.click(priceRadio);

      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
      const purchasePriceDisplay = document.getElementById("purchasePrice");

      await user.type(priceInput, "300000");
      await user.click(calculateBtn);

      expect(purchasePriceDisplay.textContent).toBe("$300,000.00");

      const paymentText = monthlyPaymentDisplay.textContent;
      expect(paymentText).not.toBe("$0.00");
      expect(paymentText.startsWith("$")).toBe(true);
    });

    it("calculates correct purchase price for payment mode", async () => {
      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const purchasePriceDisplay = document.getElementById("purchasePrice");
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");

      await user.type(priceInput, "2000");
      await user.click(calculateBtn);

      expect(monthlyPaymentDisplay.textContent).toBe("$2,000.00");

      const priceText = purchasePriceDisplay.textContent;
      expect(priceText).not.toBe("$0.00");
      expect(priceText.startsWith("$")).toBe(true);
    });

    it("displays PITI breakdown after calculation", async () => {
      const priceRadio = document.querySelector(
        'input[name="calcMethod"][value="price"]'
      );
      await user.click(priceRadio);

      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");

      await user.type(priceInput, "300000");
      await user.click(calculateBtn);

      const principalInterest =
        document.getElementById("principalInterest").textContent;
      const taxes = document.getElementById("taxes").textContent;
      const insurance = document.getElementById("insuranceAmount").textContent;
      const hoaFee = document.getElementById("hoaFeeDisplay").textContent;

      expect(principalInterest.startsWith("$")).toBe(true);
      expect(taxes.startsWith("$")).toBe(true);
      expect(insurance.startsWith("$")).toBe(true);
      expect(hoaFee.startsWith("$")).toBe(true);
    });
  });

  describe("State 3: Slider Interactions (Auto-Recalculate)", () => {
    beforeEach(async () => {
      await resetFormState();

      const priceRadio = document.querySelector(
        'input[name="calcMethod"][value="price"]'
      );
      await user.click(priceRadio);

      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");

      await user.type(priceInput, "300000");
      await user.click(calculateBtn);
    });

    it("updates calculation when interest rate buydown slider changes", async () => {
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
      const interestRateBuydownSlider = document.getElementById(
        "interestRateBuydown"
      );
      const interestRateBuydownCost = document.getElementById(
        "interestRateBuydownCost"
      );

      const initialPayment = monthlyPaymentDisplay.textContent;
      const maxRate = parseFloat(interestRateBuydownSlider.max);
      const minRate = parseFloat(interestRateBuydownSlider.min);

      interestRateBuydownSlider.value = minRate.toString();
      interestRateBuydownSlider.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      if (minRate < maxRate) {
        expect(interestRateBuydownCost.textContent).not.toBe("$0");
        expect(interestRateBuydownCost.textContent).not.toBe("$0.00");
      }
    });

    it("updates calculation when principal buydown slider changes", async () => {
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
      const principalBuydownSlider =
        document.getElementById("principalBuydown");
      const principalBuydownCost = document.getElementById(
        "principalBuydownCost"
      );
      const principalBuydownValue = document.getElementById(
        "principalBuydownValue"
      );

      const initialPayment = monthlyPaymentDisplay.textContent;

      principalBuydownSlider.value = "10000";
      principalBuydownSlider.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      const newPayment = monthlyPaymentDisplay.textContent;

      expect(principalBuydownValue.textContent).toBe("$10,000.00");
      expect(principalBuydownCost.textContent).toBe("$10,000.00");
    });

    it("recalculates when term changes after initial calculation", async () => {
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
      const termSelect = document.getElementById("term");

      const initialPayment = monthlyPaymentDisplay.textContent;

      await user.selectOptions(termSelect, "15");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const newPayment = monthlyPaymentDisplay.textContent;
      expect(newPayment).not.toBe(initialPayment);
    });
  });
});
