"use client";

import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { useState, useEffect } from "react";
import { ClientSafeProvider, LiteralUnion, signIn } from "next-auth/react";
import { BuiltInProviderType } from "next-auth/providers/index";
import Spinner from "@bytesend/ui/src/spinner";
import Link from "next/link";
import { useSearchParams as useNextSearchParams } from "next/navigation";
import { FaDiscord, FaGithub, FaGoogle } from "react-icons/fa6";
import { Callout } from "@bytesend/ui/src/callout";
import { AuthDivider, AuthShell } from "~/components/auth/auth-shell";

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

  const verifying = isVerifying || emailSent;

  return (
    <AuthShell
      title={verifying ? "Check your email" : isSignup ? "Create your account" : "Sign in to ByteSend"}
      description={
        verifying ? (
          <>
            We sent a 6-character code to {email ? <span className="font-medium text-foreground">{email}</span> : "your email address"}. Enter it below or
            click the link in the email.
          </>
        ) : isSignup ? (
          "Free to start. No credit card needed."
        ) : (
          "Welcome back."
        )
      }
      footer={
        verifying ? null : (
          <>
            {isSignup ? "Already have an account?" : "New to ByteSend?"}{" "}
            <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-primary hover:underline">
              {isSignup ? "Sign in" : "Create an account"}
            </Link>
          </>
        )
      }
    >
      {verifying ? (
        <div className="space-y-4">
          {codeError ? <Callout tone="danger">{codeError}</Callout> : null}

          <form onSubmit={handleVerificationCodeSubmit} className="space-y-3">
            <Input
              type="text"
              placeholder="ABC123"
              value={verificationCode.toUpperCase()}
              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="h-11 text-center font-mono text-lg uppercase tracking-[0.4em]"
              autoComplete="one-time-code"
              aria-label="Code from the email"
              autoFocus
            />
            {!showResend ? (
              <p className={`text-xs ${timeRemaining < 300 ? "text-destructive" : "text-muted-foreground"}`}>
                The code expires in {formatTime(timeRemaining)}.
              </p>
            ) : null}
            {showResend ? (
              <Button onClick={handleResendEmail} type="button" className="h-10 w-full" disabled={emailLoading}>
                {emailLoading ? <Spinner className="size-4" /> : "Send a new code"}
              </Button>
            ) : (
              <Button type="submit" className="h-10 w-full" disabled={codeLoading || verificationCode.length !== 6}>
                {codeLoading ? <Spinner className="size-4" /> : "Verify and continue"}
              </Button>
            )}
          </form>

          <button
            type="button"
            onClick={() => {
              setEmailSent(false);
              setEmail("");
              setVerificationCode("");
              setCodeError(null);
              sessionStorage.removeItem(SESSION_EMAIL_KEY);
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Use a different email
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {errorParam === "blocked" ? (
            <Callout tone="danger">
              This email address can&apos;t be used for a ByteSend account. If you think that&apos;s a mistake, contact support.
            </Callout>
          ) : null}
          {errorParam === "unverified_email" ? (
            <Callout tone="warning">
              That account&apos;s email isn&apos;t verified with the provider. Verify it there, or continue with your email instead.
            </Callout>
          ) : null}

          {oauthProviders.length > 0 ? (
            <div className="grid gap-2">
              {oauthProviders.map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  className="h-10 w-full gap-2.5"
                  onClick={() => handleOAuthSubmit(provider.id)}
                  disabled={submittedProvider === provider.id}
                >
                  {submittedProvider === provider.id ? <Spinner className="size-4" /> : providerIcons[provider.id]}
                  Continue with {provider.name}
                </Button>
              ))}
            </div>
          ) : null}

          {hasEmailProvider && oauthProviders.length > 0 ? <AuthDivider /> : null}

          {hasEmailProvider ? (
            <form onSubmit={handleEmailSubmit} className="space-y-2.5">
              <label htmlFor="login-email" className="text-[13px] font-medium text-foreground">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10"
              />
              <Button type="submit" className="h-10 w-full" disabled={emailLoading}>
                {emailLoading ? <Spinner className="size-4" /> : "Continue with email"}
              </Button>
            </form>
          ) : null}

          {hasEmailProvider || oauthProviders.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowBackupEmailLogin(!showBackupEmailLogin)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showBackupEmailLogin ? "Hide backup sign-in" : "Sign in with a backup email and password"}
            </button>
          ) : null}

          {showBackupEmailLogin ? (
            <form onSubmit={handleBackupEmailSubmit} className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-4">
              {backupError ? <Callout tone="danger">{backupError}</Callout> : null}
              <Input
                type="email"
                placeholder="Backup email"
                value={backupEmail}
                onChange={(e) => setBackupEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                type="password"
                placeholder="Password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Button type="submit" className="w-full" disabled={backupLoading}>
                {backupLoading ? <Spinner className="size-4" /> : "Sign in"}
              </Button>
            </form>
          ) : null}
        </div>
      )}
    </AuthShell>
  );
}
