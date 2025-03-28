class MortgageCalculator {
  constructor() {
    this.calcMethod = "payment";
  }

  setCalcMethod(method) {
    this.calcMethod = method;
  }

  formatNumber(num, decimals = 2, prefix = "$") {
    if (isNaN(num)) return "";
    return `${prefix}${num
      .toFixed(decimals)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }

  parseInput(value) {
    return parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
  }

  calculateMonthlyPayment(principal, rate, term) {
    const monthlyRate = rate / 100 / 12;
    const numberOfPayments = term * 12;

    if (monthlyRate === 0) {
      return principal / numberOfPayments;
    }

    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    return Math.round(monthlyPayment * 100) / 100;
  }

  calculatePurchasePrice(payment, rate, term, taxRate, insurance, downPayment) {
    const monthlyRate = rate / 100 / 12;
    const numberOfPayments = term * 12;
    const monthlyTax = taxRate / 100 / 12;

    // Initial guess for principal
    let principal = payment * numberOfPayments;
    let monthlyPayment = this.calculateMonthlyPayment(principal, rate, term);
    let totalMonthlyPayment =
      monthlyPayment + principal * monthlyTax + insurance;

    // Binary search to find the correct principal
    let low = 0;
    let high = payment * numberOfPayments * 2;
    let iterations = 0;
    const maxIterations = 100;

    while (
      Math.abs(totalMonthlyPayment - payment) > 0.01 &&
      iterations < maxIterations
    ) {
      if (totalMonthlyPayment > payment) {
        high = principal;
      } else {
        low = principal;
      }

      principal = (low + high) / 2;
      monthlyPayment = this.calculateMonthlyPayment(principal, rate, term);
      totalMonthlyPayment = monthlyPayment + principal * monthlyTax + insurance;
      iterations++;
    }

    return principal + downPayment;
  }

  calculate(inputs) {
    const { price, term, rate, tax, insurance, downPayment } = inputs;

    if (this.calcMethod === "payment") {
      const principal = this.parseInput(price) - this.parseInput(downPayment);
      const monthlyPayment = this.calculateMonthlyPayment(
        principal,
        this.parseInput(rate),
        this.parseInput(term)
      );

      const monthlyTax =
        (this.parseInput(price) * this.parseInput(tax)) / 100 / 12;
      const totalMonthlyPayment =
        monthlyPayment + monthlyTax + this.parseInput(insurance);

      return {
        monthlyPayment: this.formatNumber(totalMonthlyPayment),
        purchasePrice: this.formatNumber(this.parseInput(price)),
      };
    } else {
      const purchasePrice = this.calculatePurchasePrice(
        this.parseInput(price),
        this.parseInput(rate),
        this.parseInput(term),
        this.parseInput(tax),
        this.parseInput(insurance),
        this.parseInput(downPayment)
      );

      const principal = purchasePrice - this.parseInput(downPayment);
      const monthlyPayment = this.calculateMonthlyPayment(
        principal,
        this.parseInput(rate),
        this.parseInput(term)
      );

      const monthlyTax = (purchasePrice * this.parseInput(tax)) / 100 / 12;
      const totalMonthlyPayment =
        monthlyPayment + monthlyTax + this.parseInput(insurance);

      return {
        monthlyPayment: this.formatNumber(totalMonthlyPayment),
        purchasePrice: this.formatNumber(purchasePrice),
      };
    }
  }
}
