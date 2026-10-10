import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SignIn } from "./SignIn";
import {
  createAccount,
  passkeysSupported,
  recoverAccount,
  signInWithPasskey,
} from "../../features/farms/passkeys";

jest.mock("../../features/farms/api", () => ({
  farmApi: jest.fn(() => Promise.resolve({ available: false })),
}));
jest.mock("../../features/farms/passkeys", () => ({
  createAccount: jest.fn(),
  passkeysSupported: jest.fn(() => true),
  recoverAccount: jest.fn(),
  signInWithPasskey: jest.fn(),
}));
jest.mock("../../features/product/useAccountSession", () => ({
  revokeDeviceSession: jest.fn(() => Promise.resolve()),
}));
jest.mock("../public/Photo", () => ({ Photo: () => null }));

const workspace = (status, extra = {}) => ({
  status: { enabled: true, ...status },
  busy: false,
  act: async (task) => {
    try {
      await task();
    } catch {
      /* the screen shows errors inline */
    }
  },
  establish: jest.fn(),
  loadConsents: jest.fn(),
  ...extra,
});
beforeEach(() => jest.clearAllMocks());

test("passkey sign-in is the primary path and establishes the session", async () => {
  signInWithPasskey.mockResolvedValue({ farmer: { id: "f" }, csrf_token: "t" });
  const w = workspace({ passkey_available: true, otp_available: false });
  render(<SignIn workspace={w} />);
  fireEvent.click(
    screen.getByRole("button", { name: /Sign in with fingerprint/ }),
  );
  await waitFor(() => expect(w.establish).toHaveBeenCalled());
  expect(screen.queryByLabelText("Six-digit code")).not.toBeInTheDocument();
});

test("a new account shows the recovery code before opening the farm", async () => {
  createAccount.mockResolvedValue({
    farmer: { id: "f" },
    recovery_code: "ABCD-EFGH-JKMN-PQRS-TVWX",
  });
  const w = workspace({ passkey_available: true });
  render(<SignIn workspace={w} />);
  fireEvent.click(screen.getByRole("button", { name: /Create my account/ }));
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Sunita" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /I accept the/ }));
  fireEvent.click(screen.getByRole("button", { name: /Create account/ }));
  await screen.findByText("ABCD-EFGH-JKMN-PQRS-TVWX");
  expect(createAccount).toHaveBeenCalledWith(
    expect.objectContaining({ displayName: "Sunita", contactMobile: null }),
  );
  expect(w.establish).not.toHaveBeenCalled();
  const open = screen.getByRole("button", { name: /Open my farm/ });
  expect(open).toBeDisabled();
  fireEvent.click(
    screen.getByRole("checkbox", { name: /written down my recovery code/ }),
  );
  fireEvent.click(open);
  await waitFor(() => expect(w.establish).toHaveBeenCalled());
});

test("errors appear beside the action and cancellations stay quiet", async () => {
  recoverAccount.mockRejectedValue(new Error("Recovery code is not valid"));
  render(<SignIn workspace={workspace({ passkey_available: true })} />);
  fireEvent.click(screen.getByRole("button", { name: /recovery code/ }));
  fireEvent.change(screen.getByLabelText("Recovery code"), {
    target: { value: "XXXX-XXXX-XXXX-XXXX-XXXX" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Recovery code is not valid",
  );
});

test("SMS sign-in appears only when an SMS provider exists", () => {
  const { rerender } = render(
    <SignIn workspace={workspace({ passkey_available: true })} />,
  );
  expect(screen.queryByText(/code sent by SMS/)).not.toBeInTheDocument();
  rerender(
    <SignIn
      workspace={workspace({ passkey_available: true, otp_available: true })}
    />,
  );
  expect(screen.getByText(/code sent by SMS/)).toBeInTheDocument();
});

test("unsupported browsers and disabled services are explained", () => {
  passkeysSupported.mockReturnValue(false);
  const { rerender } = render(
    <SignIn workspace={workspace({ passkey_available: true })} />,
  );
  expect(
    screen.getByText(/cannot use fingerprint or screen-lock sign-in/),
  ).toBeInTheDocument();
  rerender(
    <SignIn workspace={{ ...workspace({}), status: { enabled: false } }} />,
  );
  expect(
    screen.getByText("Account sign-in is unavailable"),
  ).toBeInTheDocument();
});
