import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./App";
it("generic error boundary offers an Overview route", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  function Broken(): React.ReactNode {
    throw new Error("test-only component failure");
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  expect(
    screen.getByRole("heading", { name: "The workspace could not render" }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Return to Overview" })
      .getAttribute("href"),
  ).toBe("/");
  log.mockRestore();
});
