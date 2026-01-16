import { screen, within, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

export { screen, within, waitFor };

/**
 * Create a user event instance for interaction simulation
 * @returns {Object} userEvent instance
 */
export function createUser() {
  return userEvent.setup();
}

/**
 * Get input by its label text (case-insensitive partial match)
 * @param {string} labelText
 * @returns {HTMLElement}
 */
export function getInputByLabel(labelText) {
  return screen.getByLabelText(new RegExp(labelText, "i"));
}

/**
 * Get button by its text content
 * @param {string} buttonText
 * @returns {HTMLElement}
 */
export function getButton(buttonText) {
  return screen.getByRole("button", { name: new RegExp(buttonText, "i") });
}

/**
 * Get select dropdown by its label
 * @param {string} labelText
 * @returns {HTMLElement}
 */
export function getSelectByLabel(labelText) {
  return screen.getByRole("combobox", { name: new RegExp(labelText, "i") });
}

/**
 * Wait for text to appear in the document
 * @param {string} text
 * @returns {Promise<HTMLElement>}
 */
export async function waitForText(text) {
  return waitFor(() => screen.getByText(new RegExp(text, "i")));
}
