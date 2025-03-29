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
    // Convert annual rate to monthly rate
    const monthlyRate = rate / 100 / 12;
    // Convert term to number of payments
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
    // turn tax rate from per $1000 to per $1
    const taxRatePerDollar = taxRate / 1000;
    // Calculate yearly tax amount
    const yearlyTax = principal * taxRatePerDollar;
    // Calculate monthly tax amount
    const monthlyTax = yearlyTax / 12;
    // Round to 2 decimal places
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
   * @returns {number} The max purchase price
   */
  calculateMaxPurchasePrice(
    desiredMonthlyPayment,
    rate,
    term,
    taxRate,
    insurance,
    hoaFee
  ) {
    const monthlyRate = rate / 100 / 12;
    const numberOfPayments = term * 12;

    // Initial guess for principal
    let principal = desiredMonthlyPayment * numberOfPayments;

    // Binary search to find the correct principal
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
      totalMonthlyPayment =
        this.calculateBaseMonthlyPayment(guess, rate, term) +
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

  calculate(inputs) {
    const { price, term, rate, tax, insurance, downPayment, hoaFee } = inputs;

    if (this.calcMethod === "payment") {
      const desiredMonthlyPayment = this.parseInput(price);

      const purchasePrice = this.calculateMaxPurchasePrice(
        desiredMonthlyPayment,
        rate,
        term,
        tax,
        insurance,
        hoaFee
      );

      const principalInterest = this.calculateBaseMonthlyPayment(
        purchasePrice,
        rate,
        term
      );

      const monthlyTax = this.calculateMonthlyTax(purchasePrice, tax);

      return {
        monthlyPayment: this.formatNumber(desiredMonthlyPayment),
        purchasePrice: this.formatNumber(purchasePrice),
        principalInterest: this.formatNumber(principalInterest),
        taxes: this.formatNumber(monthlyTax),
        insuranceAmount: this.formatNumber(insurance),
        hoaFee: this.formatNumber(hoaFee),
      };
    } else {
      const purchasePrice = price;
      const principal = purchasePrice - downPayment;

      const principalInterest = this.calculateBaseMonthlyPayment(
        principal,
        rate,
        term
      );

      const monthlyTax = this.calculateMonthlyTax(purchasePrice, tax);

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
}
