import {
  createAccount,
  passkeysSupported,
  signInWithPasskey,
} from "./passkeys";
import { farmApi } from "./api";

jest.mock("./api", () => ({ farmApi: jest.fn() }));

const bytes = (...values) => new Uint8Array(values).buffer;
const b64url = (value) => Buffer.from(value).toString("base64url");

beforeEach(() => {
  farmApi.mockReset();
  window.PublicKeyCredential = function PublicKeyCredential() {};
  navigator.credentials = { create: jest.fn(), get: jest.fn() };
});

test("support requires the WebAuthn API", () => {
  expect(passkeysSupported()).toBe(true);
  delete window.PublicKeyCredential;
  expect(passkeysSupported()).toBe(false);
});

test("account creation decodes server options and posts a JSON credential", async () => {
  farmApi
    .mockResolvedValueOnce({
      challenge_id: "challenge-1",
      options: {
        challenge: b64url("server-challenge"),
        rp: { id: "localhost", name: "Krishyak" },
        user: { id: b64url("user-id"), name: "Ramesh", displayName: "Ramesh" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        excludeCredentials: [],
      },
    })
    .mockResolvedValueOnce({ farmer: { id: "f" }, recovery_code: "AAAA" });
  navigator.credentials.create.mockResolvedValue({
    id: "cred-1",
    rawId: bytes(1, 2, 3),
    type: "public-key",
    getClientExtensionResults: () => ({}),
    response: {
      clientDataJSON: bytes(4),
      attestationObject: bytes(5),
      getTransports: () => ["internal"],
    },
  });
  const result = await createAccount({
    displayName: "Ramesh",
    contactMobile: "+919876543210",
    language: "hi",
  });
  expect(result.recovery_code).toBe("AAAA");
  const options = navigator.credentials.create.mock.calls[0][0].publicKey;
  expect(Buffer.from(options.challenge).toString()).toBe("server-challenge");
  expect(Buffer.from(options.user.id).toString()).toBe("user-id");
  expect(farmApi.mock.calls[0][1].body).toMatchObject({
    display_name: "Ramesh",
    contact_mobile: "+919876543210",
    preferred_language: "hi",
  });
  const sent = farmApi.mock.calls[1][1].body;
  expect(sent.challenge_id).toBe("challenge-1");
  expect(sent.credential).toMatchObject({
    id: "cred-1",
    rawId: "AQID",
    response: { attestationObject: "BQ", transports: ["internal"] },
  });
});

test("a cancelled fingerprint prompt is reported plainly and not as a failure", async () => {
  farmApi.mockResolvedValueOnce({
    challenge_id: "c",
    options: { challenge: b64url("x"), allowCredentials: [] },
  });
  navigator.credentials.get.mockRejectedValue(
    Object.assign(new Error("x"), { name: "NotAllowedError" }),
  );
  await expect(signInWithPasskey()).rejects.toMatchObject({
    cancelled: true,
    message: expect.stringMatching(/cancelled/),
  });
  expect(farmApi).toHaveBeenCalledTimes(1);
});
