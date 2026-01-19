import { describe, it, expect } from "bun:test";

describe("Test infrastructure", () => {
  it("should run tests successfully", () => {
    expect(1 + 1).toBe(2);
  });
});

describe("Test Environment", () => {
  it("has DOM APIs available", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
    expect(typeof document.createElement).toBe("function");
  });

  it("can create and query DOM elements", () => {
    document.body.innerHTML = '<div id="test">Hello</div>';
    const el = document.getElementById("test");
    expect(el).not.toBeNull();
    expect(el.textContent).toBe("Hello");
  });
});
