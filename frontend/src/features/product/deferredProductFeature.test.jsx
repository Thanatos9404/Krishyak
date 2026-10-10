import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { deferredFeature } from "./deferredProductFeature";
import { ProductLocaleProvider } from "./ProductLocale";

test("product deferred views load with the product locale alone and receive current props", async () => {
  let finish;
  const loader = jest.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const View = deferredFeature(loader);
  expect(loader).not.toHaveBeenCalled();
  const { rerender } = render(
    <ProductLocaleProvider>
      <View field="Rice" />
    </ProductLocaleProvider>,
  );
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  rerender(
    <ProductLocaleProvider>
      <View field="Wheat" />
    </ProductLocaleProvider>,
  );
  await act(async () => finish({ default: ({ field }) => <p>{field}</p> }));
  expect(screen.getByText("Wheat")).toBeVisible();
  expect(loader).toHaveBeenCalledTimes(1);
});

test("a failed product view can retry without losing the surrounding field draft", async () => {
  const noise = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ default: () => <p>View ready</p> });
    const View = deferredFeature(loader);
    render(
      <ProductLocaleProvider>
        <input aria-label="Field area" defaultValue="2" />
        <View />
      </ProductLocaleProvider>,
    );
    fireEvent.change(screen.getByLabelText("Field area"), {
      target: { value: "7" },
    });
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("View ready")).toBeVisible();
    expect(screen.getByLabelText("Field area")).toHaveValue("7");
    expect(loader).toHaveBeenCalledTimes(2);
  } finally {
    noise.mockRestore();
  }
});
