document.addEventListener("DOMContentLoaded", async () => {
  const calculator = new MortgageCalculator();

  // Get DOM elements
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
  const totalBuydownCostDisplay = document.getElementById("totalBuydownCost");

  const { createClient } = supabase;

  const supabaseUrl = "https://iqmfcfigrvrsuwqvlnfw.supabase.co";
  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxbWZjZmlncnZyc3V3cXZsbmZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2MDkwMzksImV4cCI6MjA1OTE4NTAzOX0.gI7FtmbUg285dXN_QTJfVLAaKwm5tbKuxbZc3kOau0Q";
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

  // Define interest rates based on term from results of getLatestMortgageRates. The first option is the base NACA rate, the second is always 1% higher.
  const interestRates = await getLatestMortgageRates(supabaseClient);

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
      interestRateBuydownSlider.value = currentRate;
      interestRateBuydownValue.textContent = `${currentRate}%`;
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
  });

  // Handle calculation method change
  calcMethodInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      calculator.setCalcMethod(e.target.value);
      priceInput.placeholder = e.target.value === "payment"
        ? "Enter desired monthly payment"
        : "Enter purchase price";
    });
  });

  // Handle calculate button click
  calculateButton.addEventListener("click", () => {
    const inputs = {
      price: parseFloat(priceInput.value) || 0,
      term: parseInt(termSelect.value) || 30,
      rate: parseFloat(rateInput.value) || 0,
      tax: parseFloat(taxInput.value) || 0,
      insurance: parseFloat(insuranceInput.value) || 0,
      downPayment: parseFloat(downPaymentInput.value) || 0,
      hoaFee: parseFloat(hoaFeeInput.value) || 0,
    };

    const results = calculator.calculate(inputs);

    monthlyPaymentDisplay.textContent = results.monthlyPayment;
    purchasePriceDisplay.textContent = results.purchasePrice;
    principalInterestDisplay.textContent = results.principalInterest;
    taxesDisplay.textContent = results.taxes;
    insuranceAmountDisplay.textContent = results.insuranceAmount;
    hoaFeeDisplay.textContent = results.hoaFee;
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

async function performMsaLookup(address) {
  try {
    const response = await fetch(
      "https://iqmfcfigrvrsuwqvlnfw.supabase.co/functions/v1/msaLookup",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Add your Supabase anon key here
          "Authorization":
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxbWZjZmlncnZyc3V3cXZsbmZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2MDkwMzksImV4cCI6MjA1OTE4NTAzOX0.gI7FtmbUg285dXN_QTJfVLAaKwm5tbKuxbZc3kOau0Q",
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

// Look up latest mortgage rates
// Assumes 'supabase' client is initialized and available globally or imported.
async function getLatestMortgageRates(supabaseClient) {
  try {
    // Fetch the latest row based on a timestamp column, e.g., 'created_at'
    // Adjust 'created_at' if your column name is different.
    const { data, error } = await supabaseClient
      .from("naca_mortgage_rates")
      .select("*") // Select all columns for the latest entry
      .order("created_at", { ascending: false }) // Order by creation time, newest first
      .limit(1) // Get only the latest row
      .single(); // Expect a single object, throws error if 0 or >1 rows returned

    if (error) {
      console.error("Supabase fetch error:", error);
      throw new Error(
        error.message || "Failed to fetch rates from Supabase.",
      );
    }

    if (!data) {
      console.warn("No mortgage rate data found in the database.");
      // Return null or a default object, depending on how you want to handle this
      return null;
    }

    // Return the data from the latest row.
    // You might need to extract specific rate columns from the 'data' object later.
    // e.g., return { "15": data.rate_15yr, "20": data.rate_20yr, "30": data.rate_30yr };
    // Data comes looking like this: {
    //     "id": 1,
    //     "thirty_year_rate": 6,
    //     "twenty_year_rate": 5.5,
    //     "fifteen_year_rate": 5.25,
    //     "updated_at": "2025-04-12T20:19:57.261619+00:00",
    //     "created_at": "2025-04-12T20:19:57.261619+00:00"
    // }
    // Transform it into the format needed for our calculator
    return {
      "15": [data.fifteen_year_rate, data.fifteen_year_rate + 1],
      "20": [data.twenty_year_rate, data.twenty_year_rate + 1],
      "30": [data.thirty_year_rate, data.thirty_year_rate + 1],
    };
  } catch (error) {
    console.error("Failed to fetch latest mortgage rates:", error);
    throw new Error("Failed to fetch latest mortgage rates from the server.");
  }
}
