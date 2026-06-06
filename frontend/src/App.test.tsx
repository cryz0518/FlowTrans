import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the interpretation workbench", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "FlowTrans" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始" })).toBeInTheDocument();
    expect(screen.getByText("等待音频输入")).toBeInTheDocument();
  });
});
