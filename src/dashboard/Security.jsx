import { useOutletContext } from "react-router-dom";
import TwoFactorSettings from "../components/TwoFactorSettings.jsx";

export default function Security() {
  const { user, refresh } = useOutletContext();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account security</h1>
        <p className="mt-1 text-sm text-fg/70">
          Manage your two-factor authentication and single-use backup codes.
        </p>
      </div>

      <TwoFactorSettings
        isEnabled={Boolean(user?.totpEnabled)}
        onStatusChange={() => refresh()}
      />
    </div>
  );
}
