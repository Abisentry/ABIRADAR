import { useState } from "react";
import { api } from "../lib/api.js";

export default function TwoFactorSettings({ isEnabled, onStatusChange }) {
  const [step, setStep] = useState("idle"); // "idle" | "qr" | "backup" | "disable"
  const [qrData, setQrData] = useState(null); // { qrCodeDataUrl, manualSecret }
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  const resetMessages = () => {
    setError("");
    setFields({});
  };

  // Step 1: Request QR code from POST /auth/2fa/setup
  const handleStartSetup = async () => {
    setBusy(true);
    resetMessages();
    try {
      const data = await api("/auth/2fa/setup", { method: "POST" });
      setQrData(data);
      setStep("qr");
    } catch (err) {
      setError(err.message || "Could not start 2FA setup.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Confirm 6-digit code via POST /auth/2fa/confirm
  const handleConfirmSetup = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      return setFields({ code: "Enter the 6-digit code from your app." });
    }
    setBusy(true);
    resetMessages();
    try {
      const data = await api("/auth/2fa/confirm", {
        method: "POST",
        body: { code },
      });
      setBackupCodes(data.backupCodes || []);
      setCode("");
      setStep("backup");
      onStatusChange?.(true);
    } catch (err) {
      setFields(err.fields || {});
      setError(err.message || "Invalid code.");
    } finally {
      setBusy(false);
    }
  };

  // Step 3: Disable 2FA via POST /auth/2fa/disable
  const handleDisable = async (e) => {
    e.preventDefault();
    setBusy(true);
    resetMessages();
    try {
      await api("/auth/2fa/disable", {
        method: "POST",
        body: { password, code },
      });
      setPassword("");
      setCode("");
      setStep("idle");
      onStatusChange?.(false);
    } catch (err) {
      setFields(err.fields || {});
      setError(err.message || "Could not disable 2FA.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-fg/10 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Two-factor authentication (2FA)</h2>
          <p className="mt-1 text-sm text-fg/70">
            Require a 6-digit authenticator code when logging into your
            institution account.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isEnabled
              ? "bg-cyan/15 text-cyan"
              : "bg-fg/10 text-fg/70"
          }`}
        >
          {isEnabled ? "Enabled" : "Off"}
        </span>
      </div>

      {error && !Object.keys(fields).length && (
        <p role="alert" className="mt-4 text-sm text-signal">
          {error}
        </p>
      )}

      {/* IDLE STATE */}
      {step === "idle" && !isEnabled && (
        <button
          type="button"
          onClick={handleStartSetup}
          disabled={busy}
          className="btn-primary mt-5"
        >
          {busy ? "Preparing…" : "Enable 2FA"}
        </button>
      )}

      {step === "idle" && isEnabled && (
        <button
          type="button"
          onClick={() => {
            resetMessages();
            setStep("disable");
          }}
          className="mt-5 rounded-lg border border-signal/40 px-4 py-2 text-sm font-semibold text-signal hover:bg-signal/10"
        >
          Disable 2FA
        </button>
      )}

      {/* STEP 1 & 2: QR CODE + CONFIRMATION */}
      {step === "qr" && qrData && (
        <form
          onSubmit={handleConfirmSetup}
          noValidate
          className="mt-6 space-y-5 border-t border-fg/10 pt-5"
        >
          <div>
            <p className="text-sm font-semibold">
              1. Scan this QR code with Google Authenticator, Authy, or 1Password
            </p>
            <img
              src={qrData.qrCodeDataUrl}
              alt="2FA QR Code"
              className="mt-3 h-44 w-44 rounded-lg border border-fg/15 bg-white p-2"
            />
            <p className="mt-2 text-xs text-fg/70">
              Can’t scan? Enter this setup key manually:{" "}
              <code className="rounded bg-fg/10 px-1.5 py-0.5 font-mono text-xs">
                {qrData.manualSecret}
              </code>
            </p>
          </div>

          <div>
            <label htmlFor="setup-totp" className="mb-1.5 block text-sm font-semibold">
              2. Enter the 6-digit code from your app
            </label>
            <input
              id="setup-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="field max-w-[11rem] text-center font-mono text-lg tracking-widest"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                resetMessages();
              }}
            />
            {fields.code && (
              <p role="alert" className="mt-1.5 text-sm text-signal">
                {fields.code}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="btn-primary"
            >
              {busy ? "Verifying…" : "Verify and enable"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setCode("");
                resetMessages();
              }}
              className="text-sm text-fg/70 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* BACKUP CODES (SHOWN ONCE) */}
      {step === "backup" && (
        <div className="mt-6 space-y-4 border-t border-fg/10 pt-5">
          <div className="rounded-lg border border-signal/30 bg-signal/10 p-3.5 text-sm">
            <p className="font-semibold">Save these backup codes somewhere safe</p>
            <p className="mt-1 text-fg/80">
              Each code can be used once to sign in if you lose your phone. They
              will not be shown again.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-fg/10 bg-fg/5 p-4 font-mono text-sm">
            {backupCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(backupCodes.join("\n"))}
              className="rounded-lg border border-fg/20 px-3.5 py-2 text-sm font-semibold hover:bg-fg/5"
            >
              Copy codes
            </button>
            <button
              type="button"
              onClick={() => {
                setBackupCodes([]);
                setStep("idle");
              }}
              className="btn-primary"
            >
              I’ve saved these codes
            </button>
          </div>
        </div>
      )}

      {/* DISABLE 2FA FORM */}
      {/* DISABLE 2FA FORM */}
      {step === "disable" && (
        <form
          onSubmit={handleDisable}
          noValidate
          className="mt-6 space-y-4 border-t border-fg/10 pt-5"
        >
          <div>
            <label htmlFor="disable-pw" className="mb-1.5 block text-sm font-semibold">
              Current password
            </label>
            <input
              id="disable-pw"
              type="password"
              autoComplete="current-password"
              className="field max-w-sm"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                resetMessages();
              }}
            />
            {fields.password && (
              <p role="alert" className="mt-1.5 text-sm text-signal">
                {fields.password}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="disable-totp" className="mb-1.5 block text-sm font-semibold">
              6-digit authenticator code
            </label>
            <input
              id="disable-totp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="field max-w-[11rem] text-center font-mono text-lg tracking-widest"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                resetMessages();
              }}
            />
            {fields.code && (
              <p role="alert" className="mt-1.5 text-sm text-signal">
                {fields.code}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Disabling…" : "Confirm disable"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setPassword("");
                setCode("");
                resetMessages();
              }}
              className="text-sm text-fg/70 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}


    

