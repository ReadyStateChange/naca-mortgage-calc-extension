/**
 * @param {number} intRate This will be a number with decimals like 6.6 or 3.4 etc
 * @param {number} term number - The number of years in the mortgage. 15 or 30
 * @param {number} principal number - The amount of money being borrowed
 * @returns {number}  This is the core monthly payment without interest, taxes, hoa
 */
function cff_pmt(intRate, term, principal) {
  // redefine intRate to be the interest charged per month
  intRate = parseFloat(intRate) / 100 / 12;
  // multiply term by 12 to redefine term to be the total number of months
  term *= 12;
  // if the intRate is so low just return below as the monthly payment
  if (intRate == 0) return parseInt((principal / term) * 100) / 100;

  // This is the monthly payment calculation
  return (
    Math.floor(
      ((principal * intRate) / (1 - Math.pow(1 + intRate, -1 * term))) * 100
    ) / 100
  );
}

function cff_pv(intRate, term, payment, futureValue) {
  intRate = intRate / 100 / 12;
  term *= 12;

  return (
    (Math.pow(1 + intRate, -1 * term) * futureValue * intRate +
      payment -
      Math.pow(1 + intRate, -1 * term) * payment) /
    intRate
  );
}
/**
 * Parses the arg passed in to conver it to a number. Returns 0 if it cannot be converted
 * @param {string|number} argValue
 * @returns {number}
 */
function cff_convertToNumber(argValue) {
  var l_iTemp;

  try {
    l_iTemp = argValue.replace(/[\,\$\%]/g, "");
  } catch (e) {
    l_iTemp = argValue;
  }

  return +l_iTemp || 0;
}

/**
 * @param {number} num  - The number to be formatted
 * @param {numer} decimalNum The number of decimals to show
 * @param {'$'|'%'} argSign To format the number as dollars or a percentage
 * @param {boolean} bolCommas To format the number with commas
 * @param {boolean} bolParens To format the number with parentheses
 * @param {boolean} bolLeadingZero To format the number with a leading zero
 * @returns {string} A string representation of the num formatted as specified
 */
function cff_formatNumber(
  num,
  decimalNum,
  argSign,
  bolCommas,
  bolParens,
  bolLeadingZero
) {
  if (isNaN(parseInt(num))) return "";

  var tmpNum = num;
  var iSign = num < 0 ? -1 : 1; // Get sign of number

  if (!decimalNum) decimalNum = 0;

  // Adjust number so only the specified number of numbers after
  // the decimal point are shown.
  tmpNum *= Math.pow(10, decimalNum);
  tmpNum = Math.round(Math.abs(tmpNum));
  tmpNum /= Math.pow(10, decimalNum);
  tmpNum *= iSign; // Readjust for sign

  // Create a string object to do our formatting on
  var tmpNumStr = new String(tmpNum);

  // See if we need to strip out the leading zero or not.
  if (!bolLeadingZero && num < 1 && num > -1 && num != 0) {
    if (tmpNumStr.length == 1) tmpNumStr = "0" + tmpNumStr;

    if (num > 0) tmpNumStr = tmpNumStr.substring(1, tmpNumStr.length);
    else tmpNumStr = "-" + tmpNumStr.substring(2, tmpNumStr.length);
  }

  // See if we need to put in the commas
  if (!bolCommas && (num >= 1000 || num <= -1000)) {
    var iStart = tmpNumStr.indexOf(".");
    if (iStart < 0) iStart = tmpNumStr.length;

    iStart -= 3;
    while (iStart >= 1) {
      tmpNumStr =
        tmpNumStr.substring(0, iStart) +
        "," +
        tmpNumStr.substring(iStart, tmpNumStr.length);
      iStart -= 3;
    }
  }

  // See if we need to use parenthesis
  if (bolParens && num < 0)
    tmpNumStr = "(" + tmpNumStr.substring(1, tmpNumStr.length) + ")";

  if (argSign == "$") tmpNumStr = "$" + tmpNumStr;
  else if (argSign == "%") tmpNumStr += "%";

  return tmpNumStr; // Return our formatted string!
}

var l_pitiCalMethod = "payment";

function getMaximumPrice(oObj, argPriceOnly) {
  var l_sZip;

  if (argPriceOnly == 1) {
    l_sZip = oObj.value;
  } else {
    l_sZip = oObj.txtZip.value;
  }

  if (l_sZip.length != 5) {
    return false;
  } else {
    var l_iMile = 20;
  }

  return false;
}

function changeProperty(oObj) {
  formCalculator.txtInsurance.value = 50;

  if (oObj.selectedIndex == 0) {
    formCalculator.txtInsurance.value = 0;
    formCalculator.txtIncomeRent.value = 0;
    formCalculator.txtIncomeRent.readOnly = true;
  } else if (oObj.selectedIndex == 1) {
    formCalculator.txtIncomeRent.value = 0;
    formCalculator.txtIncomeRent.readOnly = true;
  } else {
    formCalculator.txtIncomeRent.readOnly = false;
  }

  compute();
}

function computeBuyDown(argValue, argMode) {
  var iTemp;

  if (l_pitiCalMethod == "price")
    iTemp = cff_convertToNumber(formCalculator.txtPITI.value);
  else
    iTemp = cff_convertToNumber(document.getElementById("txtPrice").innerHTML);

  if (iTemp < 1000) return;

  var iMortgage =
    iTemp - cff_convertToNumber(formCalculator.txtReduction.value);

  if (argMode == 1) {
    formCalculator.txtBuyDown.setAttribute("previousValue", argValue);
    if (formCalculator.oSelTerm.value == "15")
      formCalculator.txtRate.value = cff_formatNumber(
        parseFloat(document.getElementById("txtRate2").innerHTML) -
          cff_convertToNumber(argValue) / 0.04 / iMortgage,
        3,
        "%"
      );
    else
      formCalculator.txtRate.value = cff_formatNumber(
        parseFloat(document.getElementById("txtRate2").innerHTML) -
          cff_convertToNumber(argValue) / 0.06 / iMortgage,
        3,
        "%"
      );
  } else {
    if (formCalculator.oSelTerm.value == "15")
      formCalculator.txtBuyDown.value = cff_formatNumber(
        iMortgage *
          ((parseFloat(document.getElementById("txtRate2").innerHTML) -
            parseFloat(argValue)) *
            0.04)
      );
    else
      formCalculator.txtBuyDown.value = cff_formatNumber(
        iMortgage *
          ((parseFloat(document.getElementById("txtRate2").innerHTML) -
            parseFloat(argValue)) *
            0.06)
      );
  }

  compute();

  if (argMode == 2) {
    try {
      if (formCalculator.txtBuyDown.getAttribute("previousValue") != "")
        while (
          Math.abs(
            cff_convertToNumber(
              formCalculator.txtBuyDown.getAttribute("previousValue")
            ) - cff_convertToNumber(formCalculator.txtBuyDown.value)
          ) > 500
        ) {
          formCalculator.txtBuyDown.value =
            formCalculator.txtBuyDown.getAttribute("previousValue");
          computeBuyDown(formCalculator.txtBuyDown.value, 1);
          computeBuyDown(formCalculator.txtRate.value, 2);
        }
    } catch (e) {}
  }
}

function changeMethod(oObj) {
  l_pitiCalMethod = oObj.value;

  if (l_pitiCalMethod == "price") {
    document.getElementById("lblPITI").innerHTML = "Desired Purchase Price";
    document.getElementById("lblPrice").innerHTML = "Desired Monthly Payment";
    formCalculator.txtPITI.maxLength = 7;
  } else {
    document.getElementById("lblPITI").innerHTML = "Desired Monthly Payment";
    document.getElementById("lblPrice").innerHTML = "Desired Purchase Price";
    formCalculator.txtPITI.maxLength = 5;
  }

  formCalculator.txtPITI.value = "";
}

function computeTax(argValue) {
  var iTemp =
    l_pitiCalMethod == "price"
      ? cff_convertToNumber(formCalculator.txtPITI.value)
      : cff_convertToNumber(document.getElementById("txtPrice").innerHTML);

  iTemp = (iTemp * argValue) / 120;
  formCalculator.txtTax.value = cff_formatNumber(iTemp);

  l_pitiCalMethod == "price" ? computePITI() : computePrice();
}

function computePrice() {
  var iPI, iPITI, iPrice, iPrevPrice, iCount, taxAmount, iInterest, iUnit;
  var li_term = formCalculator.oSelTerm.value;

  iInterest = parseFloat(formCalculator.txtRate.value);
  iCount = 0;

  iUnit = cff_convertToNumber(formCalculator.oSelProperty.value);
  if (iUnit == 0) iUnit = 1;

  iPITI = cff_convertToNumber(formCalculator.txtInsurance.value) * iUnit;
  iPITI =
    cff_convertToNumber(formCalculator.txtPITI.value) -
    iPITI -
    cff_convertToNumber(formCalculator.txtFee.value); //- cff_convertToNumber(txtNSF.value)
  iPITI +=
    cff_convertToNumber(formCalculator.txtIncomeRent.value) *
    (iUnit - 1) *
    0.75;

  iPI = iPITI;

  iPrice = cff_pv(iInterest, li_term, iPI, 0);

  taxAmount = (iPrice * formCalculator.oSelTax.value) / 120;

  while (Math.abs(iPI + taxAmount - iPITI) > 0 && iCount < 1000) {
    iPrevPrice = iPrice;
    iPrice = cff_pv(iInterest, li_term, iPI, 0);
    taxAmount = Math.round((iPrice * formCalculator.oSelTax.value) / 120);

    iPI = iPI - Math.round((iPI + taxAmount - iPITI) / 2);

    if (iPrevPrice == iPrice && iCount > 0) break;

    iCount++;
  }

  iPrevPrice += cff_convertToNumber(formCalculator.txtReduction.value);

  document.getElementById("txtPrice").innerHTML = cff_formatNumber(
    iPrevPrice,
    0,
    "$"
  );
  formCalculator.txtTax.value = Math.round(
    (iPrevPrice * formCalculator.oSelTax.value) / 120
  );
}

function computePITI() {
  var iPI, iPITI, iUnit;
  var iMortgage =
    cff_convertToNumber(formCalculator.txtPITI.value) -
    cff_convertToNumber(formCalculator.txtReduction.value);

  iPI = cff_pmt(
    formCalculator.txtRate.value,
    formCalculator.oSelTerm.value,
    iMortgage
  );

  iUnit = cff_convertToNumber(formCalculator.oSelProperty.value);

  if (iUnit == 0) iUnit = 1;

  iPITI = cff_convertToNumber(formCalculator.txtInsurance.value) * iUnit;
  iPITI =
    iPI +
    iPITI +
    cff_convertToNumber(formCalculator.txtTax.value) +
    cff_convertToNumber(formCalculator.txtFee.value); //+ cff_convertToNumber(txtNSF.value)
  iPITI -=
    cff_convertToNumber(formCalculator.txtIncomeRent.value) *
    (iUnit - 1) *
    0.75;

  document.getElementById("txtPrice").innerHTML = cff_formatNumber(
    iPITI,
    0,
    "$"
  );
}

function compute() {
  if (cff_convertToNumber(formCalculator.txtPITI.value) < 100) return;

  if (l_pitiCalMethod == "price") {
    computeTax(formCalculator.oSelTax.value);
    computePITI();
  } else {
    computePrice();
  }
}

function changeTerm(oObj) {
  var l_sRate = oObj.options[oObj.selectedIndex].interestRate;
  formCalculator.txtRate.value = l_sRate;

  document.getElementById("txtRate2").innerHTML = l_sRate;

  var l_oRate = document.getElementById("oSelRate");

  l_oRate.length = 0;
  l_oRate.options[0] = new Option(l_sRate, l_sRate);
  l_sRate = parseFloat(l_sRate) + 1 + "%";
  l_oRate.options[1] = new Option(l_sRate, l_sRate);

  formCalculator.txtBuyDown.setAttribute("previousValue", "");
  formCalculator.txtBuyDown.value = "";

  compute();
}

function fillRate() {
  var thirtyYearRate = "5.625%";
  var twentyYearRate = "5.125%";
  var fifteenYearRate = "5%";

  document.getElementById("txtRate2").innerHTML = thirtyYearRate;
  formCalculator.txtRate.value = thirtyYearRate;
  formCalculator.oSelTerm.options[0].interestRate = thirtyYearRate;
  formCalculator.oSelTerm.options[1].interestRate = twentyYearRate;
  formCalculator.oSelTerm.options[2].interestRate = fifteenYearRate;

  changeTerm(formCalculator.oSelTerm);
}

function changeRate(oObj) {
  document.getElementById("txtRate2").innerHTML = oObj.value;
  formCalculator.txtRate.value = oObj.value;

  formCalculator.txtBuyDown.setAttribute("previousValue", "");
  formCalculator.txtBuyDown.value = "";
}

fillRate();
