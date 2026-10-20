"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { AuthShell } from "~/components/auth/auth-shell";
import { toast } from "@bytesend/ui/src/toaster";

export function TwoFactorVerifyContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [code, setCode] = useState("");
    const [useRecoveryCode, setUseRecoveryCode] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        if (!code.trim()) {
            toast.error("Please enter a code");
            return;
        }

        setIsVerifying(true);
        try {
            const body = useRecoveryCode
                ? { recoveryCode: code }
                : { code: code };

            const res = await fetch("/api/auth/2fa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const json = await res.json();

            if (!res.ok) {
                toast.error(json.error ?? "Verification failed");
                setCode("");
                return;
            }

            toast.success("Two-factor authentication verified");
            const redirect = searchParams.get("redirect") || "/dashboard";
            router.push(redirect);
        } catch (err) {
            toast.error("Verification failed. Please try again.");
            setCode("");
        } finally {
            setIsVerifying(false);
        }
    }

    const toggleCodeType = () => {
        setUseRecoveryCode(!useRecoveryCode);
        setCode("");
    };

    return (
        <AuthShell
            aside={false}
            title="Two-step verification"
            description={
                useRecoveryCode
                    ? "Enter one of the 10-character recovery codes you saved when you set this up."
                    : "Enter the 6-digit code from your authenticator app."
            }
            footer={<span className="text-xs">You won&apos;t be asked again on this device for 12 hours.</span>}
        >
            <form onSubmit={handleVerify} className="space-y-3">
                <Input
                    placeholder={useRecoveryCode ? "AABBCCDDEE" : "123456"}
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                    maxLength={useRecoveryCode ? 10 : 6}
                    className="h-11 text-center font-mono text-lg tracking-[0.3em]"
                    autoComplete="one-time-code"
                    inputMode={useRecoveryCode ? "text" : "numeric"}
                    aria-label={useRecoveryCode ? "Recovery code" : "Authenticator code"}
                    disabled={isVerifying}
                    autoFocus
                />
                <Button
                    type="submit"
                    isLoading={isVerifying}
                    disabled={isVerifying || (useRecoveryCode ? code.length !== 10 : code.length !== 6)}
                    className="h-10 w-full"
                >
                    Verify
                </Button>
            </form>
            <button
                type="button"
                onClick={toggleCodeType}
                disabled={isVerifying}
                className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
                {useRecoveryCode ? "Use your authenticator app instead" : "Lost your authenticator? Use a recovery code"}
            </button>
        </AuthShell>
    );
}
