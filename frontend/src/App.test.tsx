import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    delete window.flowtransDesktop;
  });

  it("renders the interpretation workbench", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "FlowTrans" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("opens and closes the desktop floating subtitle window", () => {
    const openFloatingWindow = vi.fn(async () => undefined);
    const closeFloatingWindow = vi.fn(async () => undefined);
    window.flowtransDesktop = {
      openFloatingWindow,
      closeFloatingWindow,
      sendFloatingSubtitles: vi.fn(async () => undefined),
      onFloatingSubtitles: vi.fn(() => () => undefined),
    };
    render(<App />);

    const floatingToggle = screen.getByRole("checkbox", { name: "desktop-floating-translation" });
    fireEvent.click(floatingToggle);
    fireEvent.click(floatingToggle);

    expect(openFloatingWindow).toHaveBeenCalledOnce();
    expect(closeFloatingWindow).toHaveBeenCalledOnce();
  });
});
