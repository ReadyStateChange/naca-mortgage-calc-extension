class MortgageCalculator {
  constructor() {
    this.calcMethod = "payment";
  }

  setCalcMethod(method) {
    this.calcMethod = method;
  }

  /**
   * Format a number to a string with a prefix and commas
   * @param {number} num
   * @param {number} decimals
   * @param {string} prefix
   * @returns {string}
   */
  formatNumber(num, decimals = 2, prefix = "$") {
    if (isNaN(num)) return "";
    return `${prefix}${num
      .toFixed(decimals)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }

  /**
   * Calculate base monthly payment of principal + interest
   * @param {number} principal
   * @param {number} rate
   * @param {number} term
   * @returns {number}
   */
  calculateBaseMonthlyPayment(principal, rate, term) {
    const monthlyRate = rate / 100 / 12;
    const numberOfPayments = term * 12;

    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
    );
  }

  /**
   * Calculate the monthly tax amount
   * @param {number} principal The purchase price of the house
   * @param {number} taxRate The tax rate per $1000 of mortgage
   * @returns {number} The monthly tax amount
   */
  calculateMonthlyTax(principal, taxRate) {
    const taxRatePerDollar = taxRate / 1000;
    const yearlyTax = principal * taxRatePerDollar;
    const monthlyTax = yearlyTax / 12;
    return Math.round(monthlyTax);
  }

  /**
   * Given a desired max monthly payment, calculate the max purchase price
   * @param {number} desiredMonthlyPayment The desired max monthly payment
   * @param {number} rate The annual interest rate
   * @param {number} term The term of the mortgage in years
   * @param {number} taxRate The tax rate per $1000 of mortgage
   * @param {number} insurance The monthly insurance amount
   * @param {number} hoaFee The monthly HOA/Condo fee
   * @param {number} [principalBuydown=0] The amount of principal to buy down
   * @returns {number} The max purchase price
   */
  calculateMaxPurchasePrice(
    desiredMonthlyPayment,
    rate,
    term,
    taxRate,
    insurance,
    hoaFee,
    principalBuydown = 0
  ) {
    const monthlyRate = rate / 100 / 12;
    const numberOfPayments = term * 12;

    const principal = desiredMonthlyPayment * numberOfPayments;

    let low = 0;
    let high = principal * 2;
    let iterations = 0;
    const maxIterations = 1000;
    let totalMonthlyPayment = 0;
    let guess = 0;
    while (
      iterations < maxIterations &&
      Math.abs(totalMonthlyPayment - desiredMonthlyPayment) > 0.01
    ) {
      guess = (low + high) / 2;
      const loanAmount =
        guess - principalBuydown > 0 ? guess - principalBuydown : 0;
      totalMonthlyPayment =
        this.calculateBaseMonthlyPayment(loanAmount, rate, term) +
        this.calculateMonthlyTax(guess, taxRate) +
        insurance +
        hoaFee;
      if (totalMonthlyPayment > desiredMonthlyPayment) {
        high = guess;
      } else {
        low = guess;
      }
      iterations++;
    }

    return guess;
  }

  /**
   * Interest rate buydown calculator. Calculates the cost to buy down the interest rate.
   * Assumes 1 point (costing 1% of principal) buys a 1/6% rate reduction for 30 or 20 year mortgages.
   * Assumes 1 point (costing 1% of principal) buys a 1/4% rate reduction for 15 year mortgages.
   *
   * @param {number} principal The principal amount of the mortgage
   * @param {number} rate The starting annual interest rate (e.g., 6.5 for 6.5%)
   * @param {number} desiredRate The target annual interest rate (e.g., 6.0 for 6.0%)
   * @param {number} term The term of the mortgage in years
   * @return {number} The cost to buy down the interest rate. Returns 0 if desiredRate >= rate.
   */
  calculateInterestRateBuydown(principal, rate, desiredRate, term) {
    if (
      isNaN(principal) ||
      isNaN(rate) ||
      isNaN(desiredRate) ||
      isNaN(term) ||
      principal <= 0 ||
      term <= 0
    ) {
      return 0;
    }

    // Enforce a maximum buydown of 1.5%
    const MAX_RATE_BUYDOWN = 1.5;
    const minAllowedRate = rate - MAX_RATE_BUYDOWN;
    const effectiveDesiredRate = Math.max(desiredRate, minAllowedRate);
    const rateDifference = rate - effectiveDesiredRate;

    if (rateDifference <= 0) {
      return 0; // No cost if the desired rate is not lower
    }

    let pointsMultiplier;
    if (term === 15) {
      // For 15 year term, 1 point buys 1/4% reduction (0.25)
      // Points = RateDifference / (1/4) = RateDifference * 4
      pointsMultiplier = 4;
    } else {
      // For other terms (e.g., 20, 30), 1 point buys 1/6% reduction (~0.1667)
      // Points = RateDifference / (1/6) = RateDifference * 6
      pointsMultiplier = 6;
    }

    const pointsNeeded = rateDifference * pointsMultiplier;

    // Calculate cost. 1 point costs 1% of the principal.
    // Cost = Points * (Principal * 1%) = Points * Principal / 100
    const cost = (pointsNeeded * principal) / 100;

    return cost;
  }

  /**
   * Calculate the monthly payment, purchase price, principal & interest, taxes, insurance, and HOA/Condo fee.
   * @param {number} price The purchase price of the house
   * @param {number} term The term of the mortgage in years
   * @param {number} rate The annual interest rate
   * @param {number} tax The tax rate per $1000 of mortgage
   * @param {number} insurance The monthly insurance amount
   * @param {number} hoaFee The monthly HOA/Condo fee
   * @param {number} [principalBuydown=0] The amount of principal to buy down
   * @returns {Object} An object containing the monthly payment, purchase price, principal & interest, taxes, insurance, and HOA/Condo fee.
   */
  calculate(inputs) {
    const {
      price,
      term,
      rate,
      tax,
      insurance,
      hoaFee,
      principalBuydown = 0, // Default to 0 if not provided
    } = inputs;

    if (this.calcMethod === "payment") {
      const desiredMonthlyPayment = price;

      // 1. Calculate max purchase price based on desired payment and *bought-down rate*
      const purchasePrice = this.calculateMaxPurchasePrice(
        desiredMonthlyPayment,
        rate, // Use the potentially bought-down rate
        term,
        tax,
        insurance,
        hoaFee,
        principalBuydown
      );

      // 2. Calculate Principal & Interest based on the full calculated principal
      //    (purchasePrice - downPayment) using the bought-down rate.
      const principal = purchasePrice - principalBuydown;
      const principalInterest = this.calculateBaseMonthlyPayment(
        principal > 0 ? principal : 0, // Use full principal
        rate, // Use the bought-down rate
        term
      );

      // 3. Calculate taxes based on the full purchase price
      const monthlyTax = this.calculateMonthlyTax(purchasePrice, tax);

      // We display the original desired payment for consistency.
      return {
        monthlyPayment: this.formatNumber(desiredMonthlyPayment),
        purchasePrice: this.formatNumber(purchasePrice),
        principalInterest: this.formatNumber(principalInterest),
        taxes: this.formatNumber(monthlyTax),
        insuranceAmount: this.formatNumber(insurance),
        hoaFee: this.formatNumber(hoaFee),
      };
    } else {
      // calcMethod === 'price'
      const purchasePrice = price;
      const principal = purchasePrice - principalBuydown;

      // 1. Calculate Principal & Interest based on the full principal
      //    using the bought-down rate.
      const principalInterest = this.calculateBaseMonthlyPayment(
        principal > 0 ? principal : 0, // Use full principal
        rate, // Use the bought-down rate
        term
      );

      // 2. Calculate taxes based on the full purchase price
      const monthlyTax = this.calculateMonthlyTax(purchasePrice, tax);

      // 3. Calculate total monthly payment
      const totalMonthlyPayment =
        principalInterest + monthlyTax + insurance + hoaFee;

      return {
        monthlyPayment: this.formatNumber(totalMonthlyPayment),
        purchasePrice: this.formatNumber(purchasePrice),
        principalInterest: this.formatNumber(principalInterest),
        taxes: this.formatNumber(monthlyTax),
        insuranceAmount: this.formatNumber(insurance),
        hoaFee: this.formatNumber(hoaFee),
      };
    }
  }

  /**
   * Calculate mortgage details and return raw numbers (not formatted strings)
   * @param {Object} inputs - Validated input object
   * @returns {Object} Raw numeric results
   */
  calculateRaw(inputs) {
    const {
      price,
      term,
      rate,
      tax,
      insurance,
      hoaFee,
      principalBuydown = 0,
    } = inputs;

    if (this.calcMethod === "payment") {
      const desiredMonthlyPayment = price;

      const purchasePrice = this.calculateMaxPurchasePrice(
        desiredMonthlyPayment,
        rate,
        term,
        tax,
        insurance,
        hoaFee,
        principalBuydown
      );

      const principal = purchasePrice - principalBuydown;
      const principalInterest = this.calculateBaseMonthlyPayment(
        principal > 0 ? principal : 0,
        rate,
        term
      );

      const monthlyTax = this.calculateMonthlyTax(purchasePrice, tax);

      return {
        monthlyPayment: desiredMonthlyPayment,
        purchasePrice: purchasePrice,
        principalInterest: principalInterest,
        taxes: monthlyTax,
        insurance: insurance,
        hoaFee: hoaFee,
      };
    } else {
      // calcMethod === 'price'
      const purchasePrice = price;
      const principal = purchasePrice - principalBuydown;

      const principalInterest = this.calculateBaseMonthlyPayment(
        principal > 0 ? principal : 0,
        rate,
        term
      );

      const monthlyTax = this.calculateMonthlyTax(purchasePrice, tax);
      const totalMonthlyPayment =
        principalInterest + monthlyTax + insurance + hoaFee;

      return {
        monthlyPayment: totalMonthlyPayment,
        purchasePrice: purchasePrice,
        principalInterest: principalInterest,
        taxes: monthlyTax,
        insurance: insurance,
        hoaFee: hoaFee,
      };
    }
  }
}

export { MortgageCalculator };
