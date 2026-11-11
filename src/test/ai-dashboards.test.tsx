import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-data", () => ({ listVerifiedMechanics: () => Promise.resolve([]) }));

import { AIDashboardsPage } from "@/routes/ai-dashboards";
import { bundledArtifact } from "@/lib/ai/load";

beforeAll(() => {
  // jsdom has no layout, so recharts warns that charts have zero size; the warning is expected here.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

describe("AI dashboards use the real trained artifact", () => {
  const art = bundledArtifact();
  const best = art.bundle.bestModel;
  const label = {
    baseline: "Baseline (rule)",
    logistic: "Logistic Regression",
    forest: "Random Forest",
  }[best];

  it("renders all four tabs with real content", async () => {
    render(<AIDashboardsPage />);
    expect(screen.getByText("Demand & Discovery Insights")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Match Predictor/ }));
    expect(screen.getByText("What-if scorer")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/No verified mechanics could be loaded/)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Model Performance/ }));
    expect(screen.getByText(/Model comparison/)).toBeInTheDocument();
    expect(screen.getByText(`${label} ★`)).toBeInTheDocument();
    expect(
      screen.getAllByText(pct(art.bundle.models[best].metrics.accuracy)).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Accuracy & Saturation/ }));
    expect(screen.getByText(/Learning curve/)).toBeInTheDocument();
    expect(screen.getByText(art.saturation["logistic"]?.note ?? "")).toBeInTheDocument();
    expect(screen.getByText(/number of trees/)).toBeInTheDocument();
  });

  it("no longer contains hardcoded placeholder metrics", () => {
    const { container } = render(<AIDashboardsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Model Performance/ }));
    const text = container.textContent ?? "";
    expect(text).not.toContain("79.3%");
    expect(text).not.toContain("76.6%");
  });
});
