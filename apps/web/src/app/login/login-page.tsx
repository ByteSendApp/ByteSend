"use client";

import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { useState, useEffect } from "react";
import { ClientSafeProvider, LiteralUnion, signIn } from "next-auth/react";
import { BuiltInProviderType } from "next-auth/providers/index";
import Spinner from "@bytesend/ui/src/spinner";
import Link from "next/link";
import { useSearchParams as useNextSearchParams } from "next/navigation";
import { FaDiscord, FaEnvelope, FaGithub, FaGoogle } from "react-icons/fa6";
import { BrandMark } from "~/lib/brand";

const SESSION_EMAIL_KEY = "bytesend_login_email";

const providerIcons: Record<string, React.ReactNode> = {
  github: <FaGithub className="size-5" />,
  google: <FaGoogle className="size-5" />,
  discord: <FaDiscord className="size-5" />,
};

export default function LoginPage({
  providers,
  isSignup = false,
}: {
  providers?: ClientSafeProvider[];
  isSignup?: boolean;
}) {
  const [submittedProvider, setSubmittedProvider] =
    useState<LiteralUnion<BuiltInProviderType> | null>(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(24 * 60 * 60); // 24 hours in seconds
  const [showResend, setShowResend] = useState(false);

  // Backup email password login state
  const [showBackupEmailLogin, setShowBackupEmailLogin] = useState(false);
  const [backupEmail, setBackupEmail] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const searchParams = useNextSearchParams();
  const inviteId = searchParams.get("inviteId");
  const isVerifying = searchParams.get("verify") === "1";
  const errorParam = searchParams.get("error");

  const requestedCallback = searchParams.get("callbackUrl");
  // Only same-site paths are honoured so the parameter can't be used as an open redirect.
  const safeCallback =
    requestedCallback && requestedCallback.startsWith("/") && !requestedCallback.startsWith("//")
      ? requestedCallback
      : null;
  const callbackUrl = inviteId
    ? `/join-team?inviteId=${inviteId}`
    : (safeCallback ?? "/dashboard");

  // When NextAuth redirects to ?verify=1 after the user clicks the magic link,
  // restore the email we stored in sessionStorage before submitting
  useEffect(() => {
    if (isVerifying) {
      const stored = sessionStorage.getItem(SESSION_EMAIL_KEY);
      if (stored) setEmail(stored);
    }
  }, [isVerifying]);

  // Countdown timer: runs whenever the code entry UI is shown
  useEffect(() => {
    if (!isVerifying && !emailSent) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setShowResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVerifying, emailSent]);

  // Show error message if callback failed (bad/expired token from magic link)
  useEffect(() => {
    if (errorParam === "Callback") {
      setCodeError(
        "Invalid or expired verification code. Please request a new sign-in link."
      );
    }
  }, [errorParam]);

  const handleOAuthSubmit = (provider: LiteralUnion<BuiltInProviderType>) => {
    setSubmittedProvider(provider);
    signIn(provider, { callbackUrl });
  };

  const handleBackupEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupEmail || !backupPassword) {
      setBackupError("Email and password are required");
      return;
    }

    setBackupLoading(true);
    setBackupError(null);
    try {
      const result = await signIn("credentials", {
        email: backupEmail,
        password: backupPassword,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setBackupError(result.error);
      } else if (result?.ok) {
        // Success: NextAuth will handle session creation and redirect
        // If 2FA is enabled, the middleware/dashboard will redirect to 2FA
        window.location.href = result.url || callbackUrl;
      }
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEmailLoading(true);
    setCodeError(null);
    try {
      const result = await signIn("email", { email, callbackUrl, redirect: false });
      // The signIn callback refuses banned or blocked addresses by redirecting to /login?error=...
      if (result?.url && new URL(result.url, window.location.origin).searchParams.get("error")) {
        window.location.href = result.url;
        return;
      }
      // Persist email so it can be restored when NextAuth redirects to ?verify=1
      sessionStorage.setItem(SESSION_EMAIL_KEY, email);
      setEmailSent(true);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerificationCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length !== 6) {
      setCodeError("Please enter the 6-character code from your email");
      return;
    }
    if (!email) {
      setCodeError("We lost track of your email address. Please go back and enter it again.");
      return;
    }

    setCodeLoading(true);
    setCodeError(null);
    // Redirect to NextAuth's email callback with the token the user typed.
    // NextAuth will verify it against the database and sign the user in.
    const params = new URLSearchParams({
      token: verificationCode,
      email,
      callbackUrl,
    });
    window.location.href = `/api/auth/callback/email?${params.toString()}`;
  };

  const handleResendEmail = async () => {
    if (!email) return;
    setEmailLoading(true);
    setCodeError(null);
    try {
      await signIn("email", { email, callbackUrl, redirect: false });
      sessionStorage.setItem(SESSION_EMAIL_KEY, email);
      setTimeRemaining(24 * 60 * 60);
      setShowResend(false);
      setVerificationCode("");
    } finally {
      setEmailLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const hasEmailProvider = providers?.some((p) => p.type === "email");
  const oauthProviders = providers?.filter((p) => p.type !== "email" && p.type !== "credentials") ?? [];

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-background px-4 py-12 overflow-hidden">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-120 w-180 rounded-full bg-primary/8 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/5 blur-[100px]" />

      <div className="relative w-full max-w-100 space-y-8">
        {/* Logo & heading */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <BrandMark size={21} />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isSignup ? "Create your account" : "Sign in to ByteSend"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSignup
                ? "Get started with email infrastructure that scales"
                : "Welcome back, let\u2019s pick up where you left off"}
            </p>
          </div>
        </div>

        {/* Email verification with code entry: shown after email is submitted OR after magic link redirect */}
        {(isVerifying || emailSent) ? (
          <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
                <FaEnvelope className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a 6-character code to{" "}
                {email ? (
                  <span className="font-medium text-foreground">{email}</span>
                ) : (
                  "your email address"
                )}
              </p>
            </div>

            {/* Error message */}
            {codeError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                <p>{codeError}</p>
              </div>
            )}

            {/* Code entry form */}
            <form onSubmit={handleVerificationCodeSubmit} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Enter code from email
                </label>
                <Input
                  type="text"
                  placeholder="ABC123"
                  value={verificationCode.toUpperCase()}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="h-11 rounded-xl bg-card/60 border-border/40 font-mono text-center uppercase tracking-widest"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground/60">
                  You can also click the magic link in your email to sign in directly
                </p>
              </div>

              {/* Time remaining */}
              {!showResend && (
                <div className="text-center">
                  <p className={`text-sm font-medium ${timeRemaining < 300 ? "text-destructive" : "text-muted-foreground"}`}>
                    Code expires in: <span className="font-semibold">{formatTime(timeRemaining)}</span>
                  </p>
                </div>
              )}

              {/* Resend button or submit */}
              {showResend ? (
                <Button
                  onClick={handleResendEmail}
                  type="button"
                  className="w-full h-11 rounded-xl"
                  disabled={emailLoading}
                >
                  {emailLoading ? (
                    <Spinner className="size-4" />
                  ) : (
                    "Send new code"
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl shadow-lg shadow-primary/20"
                  disabled={codeLoading || verificationCode.length !== 6}
                >
                  {codeLoading ? (
                    <Spinner className="size-4" />
                  ) : (
                    "Verify code"
                  )}
                </Button>
              )}
            </form>

            {/* Back button */}
            <button
              onClick={() => {
                setEmailSent(false);
                setEmail("");
                setVerificationCode("");
                setCodeError(null);
                sessionStorage.removeItem(SESSION_EMAIL_KEY);
              }}
              className="w-full text-center text-sm text-primary hover:underline mt-2"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            {errorParam === "blocked" && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                <p>
                  This email address can&apos;t be used to create a ByteSend account. If you think this is a mistake,
                  contact support.
                </p>
              </div>
            )}

            {errorParam === "unverified_email" && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                <p>
                  That account&apos;s email address isn&apos;t verified with the provider. Verify it there, or sign in
                  with your email instead.
                </p>
              </div>
            )}

            {/* Email form */}
            {hasEmailProvider && (
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl bg-card/60 border-border/40"
                />
                <Button type="submit" className="w-full h-11 rounded-xl shadow-lg shadow-primary/20" disabled={emailLoading}>
                  {emailLoading ? (
                    <Spinner className="size-4" />
                  ) : (
                    <>
                      <FaEnvelope className="size-4 mr-2" />
                      Continue with email
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Divider */}
            {hasEmailProvider && oauthProviders.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/30" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground/50">or</span>
                </div>
              </div>
            )}

            {/* OAuth buttons */}
            <div className="flex flex-col gap-2.5">
              {oauthProviders.map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  className="w-full h-11 gap-3 font-medium rounded-xl border-border/40 bg-card/40 hover:bg-card/80"
                  onClick={() => handleOAuthSubmit(provider.id)}
                  disabled={submittedProvider === provider.id}
                >
                  {submittedProvider === provider.id ? (
                    <Spinner className="size-4" />
                  ) : (
                    providerIcons[provider.id]
                  )}
                  Continue with {provider.name}
                </Button>
              ))}
            </div>

            {/* Divider before backup email option */}
            {(hasEmailProvider || oauthProviders.length > 0) && (
              <button
                type="button"
                onClick={() => setShowBackupEmailLogin(!showBackupEmailLogin)}
                className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {showBackupEmailLogin ? "Hide" : "Have a backup email password?"}
              </button>
            )}

            {/* Backup email password login form */}
            {showBackupEmailLogin && (
              <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3">
                <form onSubmit={handleBackupEmailSubmit} className="space-y-3">
                  {backupError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                      {backupError}
                    </div>
                  )}
                  <Input
                    type="email"
                    placeholder="backup@example.com"
                    value={backupEmail}
                    onChange={(e) => setBackupEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-10 rounded-lg bg-card/60 border-border/40 text-sm"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-10 rounded-lg bg-card/60 border-border/40 text-sm"
                  />
                  <Button
                    type="submit"
                    className="w-full h-10 rounded-lg text-sm"
                    disabled={backupLoading}
                  >
                    {backupLoading ? (
                      <Spinner className="size-4" />
                    ) : (
                      "Sign in with backup email"
                    )}
                  </Button>
                </form>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "Don\u2019t have an account?"}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="text-primary hover:underline ml-1 font-medium"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground/40">
            © {new Date().getFullYear()} NodeByte LTD
          </p>
        </div>
      </div>
    </main>
  );
}