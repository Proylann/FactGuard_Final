import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fadeIn } from './animations';

type SettingsViewProps = {
  userName: string;
  userEmail: string;
  isMfaEnabled: boolean;
  onUpdateUsername: (username: string) => Promise<{ ok: boolean; message: string }>;
  onToggleMfa: (enabled: boolean) => Promise<{ ok: boolean; message: string; enabled?: boolean }>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; message: string }>;
};

export default function SettingsView({
  userName,
  userEmail,
  isMfaEnabled,
  onUpdateUsername,
  onToggleMfa,
  onChangePassword,
}: SettingsViewProps) {
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(userName);
  const [mfaEnabled, setMfaEnabled] = useState(isMfaEnabled);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setUsernameDraft(userName);
  }, [userName]);

  useEffect(() => {
    setMfaEnabled(isMfaEnabled);
  }, [isMfaEnabled]);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  return (
    <motion.section variants={fadeIn} initial="initial" animate="animate" exit="exit" className="space-y-6 max-w-5xl">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10">
        <h3 className="text-2xl font-black text-slate-900">Profile</h3>
        <div className="mt-6 flex flex-col md:flex-row md:items-center gap-6">
          <div className="h-20 w-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-3xl font-black">
            {(userName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            {editingUsername ? (
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  value={usernameDraft}
                  onChange={(e) => {
                    setUsernameDraft(e.target.value);
                    clearMessages();
                  }}
                  placeholder="New username"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none"
                />
                <button
                  disabled={busy}
                  onClick={async () => {
                    const next = usernameDraft.trim();
                    if (!next) {
                      setErrorMessage('Username is required.');
                      return;
                    }
                    setBusy(true);
                    const res = await onUpdateUsername(next);
                    setBusy(false);
                    if (res.ok) {
                      setSuccessMessage(res.message);
                      setEditingUsername(false);
                    } else {
                      setErrorMessage(res.message);
                    }
                  }}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  Save Username
                </button>
              </div>
            ) : (
              <>
                <p className="text-2xl font-black text-slate-900">{userName}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{userEmail}</p>
              </>
            )}
          </div>
          {!editingUsername && (
            <button
              onClick={() => {
                clearMessages();
                setEditingUsername(true);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
            >
              Edit Username
            </button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10 space-y-6">
        <h3 className="text-2xl font-black text-slate-900">Security Settings</h3>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-900">Multi-Factor Authentication</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {mfaEnabled ? 'Enabled. Login requires an OTP.' : 'Disabled. Login uses password only.'}
            </p>
          </div>
          <button
            disabled={busy}
            onClick={async () => {
              clearMessages();
              setBusy(true);
              const res = await onToggleMfa(!mfaEnabled);
              setBusy(false);
              if (res.ok) {
                setMfaEnabled(typeof res.enabled === 'boolean' ? res.enabled : !mfaEnabled);
                setSuccessMessage(res.message);
              } else {
                setErrorMessage(res.message);
              }
            }}
            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider disabled:opacity-60 ${
              mfaEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {mfaEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-900 mb-3">Change Password</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                clearMessages();
              }}
              placeholder="Current password"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                clearMessages();
              }}
              placeholder="New password"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearMessages();
              }}
              placeholder="Confirm password"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none"
            />
          </div>
          <button
            disabled={busy}
            onClick={async () => {
              if (!currentPassword || !newPassword || !confirmPassword) {
                setErrorMessage('Please fill in all password fields.');
                return;
              }
              if (newPassword !== confirmPassword) {
                setErrorMessage('New password and confirm password do not match.');
                return;
              }
              setBusy(true);
              const res = await onChangePassword(currentPassword, newPassword);
              setBusy(false);
              if (res.ok) {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setSuccessMessage(res.message);
              } else {
                setErrorMessage(res.message);
              }
            }}
            className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            Update Password
          </button>
        </div>

        {errorMessage && <p className="text-sm font-bold text-red-600">{errorMessage}</p>}
        {successMessage && <p className="text-sm font-bold text-emerald-600">{successMessage}</p>}
      </div>
    </motion.section>
  );
}
