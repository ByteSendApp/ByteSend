"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@bytesend/ui/src/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@bytesend/ui/src/form";
import { Input } from "@bytesend/ui/src/input";
import { toast } from "@bytesend/ui/src/toaster";

import { api } from "~/trpc/react";
import { ConnectedAccounts } from "./connected-accounts";

const accountEmailSchema = z.object({
    email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
});
type AccountEmailFormData = z.infer<typeof accountEmailSchema>;

const emailVerificationSchema = z.object({
    code: z.string().trim().toUpperCase().length(6, "Enter the 6-character code"),
});
type EmailVerificationFormData = z.infer<typeof emailVerificationSchema>;

const twoFactorCodeSchema = z.object({
    code: z.string().trim().length(6, "Enter a valid 6-digit code"),
});
type TwoFactorCodeFormData = z.infer<typeof twoFactorCodeSchema>;

const backupEmailSchema = z.object({
    email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});
type BackupEmailFormData = z.infer<typeof backupEmailSchema>;

const backupEmailVerifySchema = z.object({
    code: z.string().trim().toUpperCase().length(6, "Enter the 6-character code"),
});
type BackupEmailVerifyFormData = z.infer<typeof backupEmailVerifySchema>;

export default function AccountSettings() {
    const utils = api.useUtils();
    const router = useRouter();
    const profileQuery = api.user.getProfile.useQuery();

    const [pendingEmail, setPendingEmail] = useState<string | null>(null);
    const [emailVerificationStep, setEmailVerificationStep] = useState<"old" | "new">("old");
    const [twoFactorSetup, setTwoFactorSetup] = useState<{
        secret: string;
        otpauthUrl: string;
    } | null>(null);
    const [showRecoveryCodes, setShowRecoveryCodes] = useState<string[] | null>(null);
    const [pendingBackupEmail, setPendingBackupEmail] = useState<string | null>(null);
    const [backupEmailPasswordHash, setBackupEmailPasswordHash] = useState<string | null>(null);

    const requestEmailChangeMutation = api.user.requestEmailChange.useMutation();
    const confirmOldEmailMutation = api.user.confirmOldEmail.useMutation();
    const confirmNewEmailMutation = api.user.confirmNewEmail.useMutation();
    const bypassOldEmailWithRecoveryCodeMutation = api.user.bypassOldEmailWithRecoveryCode.useMutation();
    const startTwoFactorSetupMutation = api.user.startTwoFactorSetup.useMutation();
    const confirmTwoFactorSetupMutation = api.user.confirmTwoFactorSetup.useMutation();
    const disableTwoFactorMutation = api.user.disableTwoFactor.useMutation();
    const regenerateRecoveryCodesMutation = api.user.regenerateRecoveryCodes.useMutation();
    const addBackupEmailMutation = api.user.addBackupEmail.useMutation();
    const verifyBackupEmailMutation = api.user.verifyBackupEmail.useMutation();
    const deleteBackupEmailMutation = api.user.deleteBackupEmail.useMutation();
    const backupEmailsQuery = api.user.getBackupEmails.useQuery();
    const recoveryCodeCountQuery = api.user.getRecoveryCodeCount.useQuery(undefined, {
        enabled: !!profileQuery.data?.twoFactorEnabled,
    });

    const emailForm = useForm<AccountEmailFormData>({
        resolver: zodResolver(accountEmailSchema),
        values: { email: profileQuery.data?.email ?? "" },
    });

    const emailVerifyForm = useForm<EmailVerificationFormData>({
        resolver: zodResolver(emailVerificationSchema),
        defaultValues: { code: "" },
    });

    const twoFactorEnableForm = useForm<TwoFactorCodeFormData>({
        resolver: zodResolver(twoFactorCodeSchema),
        defaultValues: { code: "" },
    });

    const twoFactorDisableForm = useForm<TwoFactorCodeFormData>({
        resolver: zodResolver(twoFactorCodeSchema),
        defaultValues: { code: "" },
    });

    const backupEmailForm = useForm<BackupEmailFormData>({
        resolver: zodResolver(backupEmailSchema),
        defaultValues: { email: "", password: "", confirmPassword: "" },
    });

    const backupEmailVerifyForm = useForm<BackupEmailVerifyFormData>({
        resolver: zodResolver(backupEmailVerifySchema),
        defaultValues: { code: "" },
    });

    async function onSaveEmail(data: AccountEmailFormData) {
        requestEmailChangeMutation.mutate(
            { email: data.email },
            {
                onSuccess: (result) => {
                    setPendingEmail(result.newEmail);
                    emailVerifyForm.reset({ code: "" });
                    toast.success("Verification code sent to both your current and new email");
                },
                onError: (e) => toast.error(e.message),
            },
        );
    }

    async function onConfirmOldEmail(data: EmailVerificationFormData) {
        if (!pendingEmail) return;

        confirmOldEmailMutation.mutate(
            { email: pendingEmail, code: data.code },
            {
                onSuccess: () => {
                    setEmailVerificationStep("new");
                    emailVerifyForm.reset({ code: "" });
                    toast.success("Current email verified. Now confirm your new email.");
                },
                onError: (e) => {
                    toast.error(e.message);
                    if (e.message.includes("lost access")) {
                        toast.info("Or use a recovery code to bypass this step");
                    }
                },
            },
        );
    }

    async function onConfirmNewEmail(data: EmailVerificationFormData) {
        if (!pendingEmail) return;

        confirmNewEmailMutation.mutate(
            { email: pendingEmail, code: data.code },
            {
                onSuccess: (updated) => {
                    setPendingEmail(null);
                    setEmailVerificationStep("old");
                    emailForm.reset({ email: updated.email ?? "" });
                    emailVerifyForm.reset({ code: "" });
                    utils.user.getProfile.invalidate();
                    router.refresh();
                    toast.success("Account email verified and updated");
                },
                onError: (e) => toast.error(e.message),
            },
        );
    }

    function onStartTwoFactor() {
        startTwoFactorSetupMutation.mutate(undefined, {
            onSuccess: (result) => {
                setTwoFactorSetup(result);
                twoFactorEnableForm.reset({ code: "" });
                toast.success("Scan the QR code and enter your authenticator code");
            },
            onError: (e) => toast.error(e.message),
        });
    }

    async function onConfirmTwoFactor(data: TwoFactorCodeFormData) {
        confirmTwoFactorSetupMutation.mutate(
            { code: data.code },
            {
                onSuccess: (result) => {
                    setTwoFactorSetup(null);
                    twoFactorEnableForm.reset({ code: "" });
                    setShowRecoveryCodes(result.recoveryCodes);
                    utils.user.getProfile.invalidate();
                    router.refresh();
                    toast.success("Two-factor authentication enabled. Save your recovery codes!");
                },
                onError: (e) => toast.error(e.message),
            },
        );
    }

    async function onDisableTwoFactor(data: TwoFactorCodeFormData) {
        disableTwoFactorMutation.mutate(
            { code: data.code },
            {
                onSuccess: () => {
                    twoFactorDisableForm.reset({ code: "" });
                    utils.user.getProfile.invalidate();
                    router.refresh();
                    toast.success("Two-factor authentication disabled");
                },
                onError: (e) => toast.error(e.message),
            },
        );
    }

    async function onAddBackupEmail(data: BackupEmailFormData) {
        addBackupEmailMutation.mutate(
            { email: data.email, password: data.password },
            {
                onSuccess: (result) => {
                    setPendingBackupEmail(result.email);
                    setBackupEmailPasswordHash(result.passwordHash);
                    backupEmailForm.reset();
                    backupEmailVerifyForm.reset({ code: "" });
                    toast.success("Verification code sent to " + result.email);
                },
                onError: (e) => toast.error(e.message),
            },
        );
    }

    async function onVerifyBackupEmail(data: BackupEmailVerifyFormData) {
        if (!pendingBackupEmail || !backupEmailPasswordHash) return;

        verifyBackupEmailMutation.mutate(
            { email: pendingBackupEmail, code: data.code, passwordHash: backupEmailPasswordHash },
            {
                onSuccess: () => {
                    setPendingBackupEmail(null);
                    setBackupEmailPasswordHash(null);
                    backupEmailVerifyForm.reset({ code: "" });
                    void backupEmailsQuery.refetch();
                    toast.success("Backup email added successfully!");
                },
                onError: (e) => toast.error(e.message),
            },
        );
    }

    async function onDeleteBackupEmail(email: string) {
        deleteBackupEmailMutation.mutate(
            { email },
            {
                onSuccess: () => {
                    void backupEmailsQuery.refetch();
                    toast.success("Backup email removed");
                },
                onError: (e) => toast.error(e.message),
            },
        );
    }

    return (
        <div className="flex flex-col gap-8 mt-6">
            {/* ── Account email ── */}
            <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-semibold mb-1">Email Address</h3>
                <p className="text-xs text-muted-foreground mb-5">
                    This email is used for login and account notifications. Changes require verification of both your current and new email.
                </p>

                    <>
                        <Form {...emailForm}>
                            <form onSubmit={emailForm.handleSubmit(onSaveEmail)} className="flex gap-3">
                                <FormField
                                    control={emailForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder="you@example.com" type="email" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button
                                    type="submit"
                                    isLoading={requestEmailChangeMutation.isPending}
                                    disabled={!emailForm.formState.isDirty}
                                >
                                    Send Codes
                                </Button>
                            </form>
                        </Form>

                        {pendingEmail ? (
                            <div className="mt-4 space-y-4">
                                {emailVerificationStep === "old" && (
                                    <div className="rounded-md border border-border bg-muted/30 p-4">
                                        <p className="text-xs text-muted-foreground mb-3">
                                            <span className="font-semibold text-foreground">Step 1:</span> Enter the code sent to your current email.
                                        </p>
                                        <Form {...emailVerifyForm}>
                                            <form onSubmit={emailVerifyForm.handleSubmit(onConfirmOldEmail)} className="flex gap-3">
                                                <FormField
                                                    control={emailVerifyForm.control}
                                                    name="code"
                                                    render={({ field }) => (
                                                        <FormItem className="flex-1">
                                                            <FormControl>
                                                                <Input placeholder="ABC123" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <Button type="submit" isLoading={confirmOldEmailMutation.isPending}>
                                                    Verify
                                                </Button>
                                            </form>
                                        </Form>
                                    </div>
                                )}

                                {emailVerificationStep === "new" && (
                                    <div className="rounded-md border border-border bg-muted/30 p-4">
                                        <p className="text-xs text-muted-foreground mb-3">
                                            <span className="font-semibold text-foreground">Step 2:</span> Enter the code sent to your new email <span className="font-semibold text-foreground">{pendingEmail}</span>.
                                        </p>
                                        <Form {...emailVerifyForm}>
                                            <form onSubmit={emailVerifyForm.handleSubmit(onConfirmNewEmail)} className="flex gap-3">
                                                <FormField
                                                    control={emailVerifyForm.control}
                                                    name="code"
                                                    render={({ field }) => (
                                                        <FormItem className="flex-1">
                                                            <FormControl>
                                                                <Input placeholder="ABC123" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <Button type="submit" isLoading={confirmNewEmailMutation.isPending}>
                                                    Complete
                                                </Button>
                                            </form>
                                        </Form>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </>
            </div>

            <ConnectedAccounts
                currentEmail={profileQuery.data?.email}
                isUsingEmail={requestEmailChangeMutation.isPending}
                onUseEmail={(email) => {
                    emailForm.setValue("email", email, { shouldDirty: true });
                    void onSaveEmail({ email });
                }}
            />

            {/* ── Backup Emails ── */}
            <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-semibold mb-1">Backup Email</h3>
                <p className="text-xs text-muted-foreground mb-5">
                    Add a backup email with password for account access if you lose your primary email. You can use this for login.
                </p>

                {backupEmailsQuery.data && backupEmailsQuery.data.length > 0 ? (
                    <div className="space-y-3">
                        {backupEmailsQuery.data.map((backup) => (
                            <div key={backup.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium">{backup.email}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Added {new Date(backup.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDeleteBackupEmail(backup.email)}
                                    isLoading={deleteBackupEmailMutation.isPending}
                                    className="text-destructive hover:text-destructive"
                                >
                                    Remove
                                </Button>
                            </div>
                        ))}

                        {!pendingBackupEmail && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    backupEmailForm.reset();
                                    setPendingBackupEmail("_init");
                                }}
                            >
                                Add Another Backup Email
                            </Button>
                        )}
                    </div>
                ) : null}

                {pendingBackupEmail !== "_init" && !pendingBackupEmail ? (
                    <Button
                        variant="outline"
                        onClick={() => setPendingBackupEmail("_init")}
                    >
                        Add Backup Email
                    </Button>
                ) : pendingBackupEmail === "_init" ? (
                    <div className="space-y-4">
                        <Form {...backupEmailForm}>
                            <form onSubmit={backupEmailForm.handleSubmit(onAddBackupEmail)} className="space-y-3">
                                <FormField
                                    control={backupEmailForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input placeholder="backup@example.com" type="email" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={backupEmailForm.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input placeholder="Password" type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={backupEmailForm.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input placeholder="Confirm password" type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex gap-3">
                                    <Button type="submit" isLoading={addBackupEmailMutation.isPending}>
                                        Send Verification Code
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setPendingBackupEmail(null);
                                            backupEmailForm.reset();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                ) : pendingBackupEmail && pendingBackupEmail !== "_init" ? (
                    <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Enter the code sent to <span className="font-semibold text-foreground">{pendingBackupEmail}</span>.
                        </p>
                        <Form {...backupEmailVerifyForm}>
                            <form onSubmit={backupEmailVerifyForm.handleSubmit(onVerifyBackupEmail)} className="flex gap-3">
                                <FormField
                                    control={backupEmailVerifyForm.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder="ABC123" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" isLoading={verifyBackupEmailMutation.isPending}>
                                    Verify
                                </Button>
                            </form>
                        </Form>
                    </div>
                ) : null}
            </div>

            {/* ── Two-factor auth ── */}
            <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-semibold mb-1">Two-Factor Authentication</h3>
                <p className="text-xs text-muted-foreground mb-5">
                    Protect your account with an authenticator app using TOTP codes.
                </p>

                {profileQuery.data?.twoFactorEnabled ? (
                    <div className="space-y-3">
                        <p className="text-xs text-emerald-500">Two-factor authentication is currently enabled.</p>
                        <Form {...twoFactorDisableForm}>
                            <form onSubmit={twoFactorDisableForm.handleSubmit(onDisableTwoFactor)} className="flex gap-3">
                                <FormField
                                    control={twoFactorDisableForm.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder="Enter authenticator code" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button variant="outline" type="submit" isLoading={disableTwoFactorMutation.isPending}>
                                    Disable
                                </Button>
                            </form>
                        </Form>
                    </div>
                ) : twoFactorSetup ? (
                    <div className="space-y-4">
                        <div className="w-fit rounded-lg border border-border bg-white p-3">
                            <QRCodeSVG value={twoFactorSetup.otpauthUrl} size={140} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            If you cannot scan the QR code, enter this secret manually: <span className="font-mono text-foreground">{twoFactorSetup.secret}</span>
                        </p>

                        <Form {...twoFactorEnableForm}>
                            <form onSubmit={twoFactorEnableForm.handleSubmit(onConfirmTwoFactor)} className="flex gap-3">
                                <FormField
                                    control={twoFactorEnableForm.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder="Enter authenticator code" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" isLoading={confirmTwoFactorSetupMutation.isPending}>
                                    Enable
                                </Button>
                            </form>
                        </Form>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTwoFactorSetup(null)}
                            disabled={confirmTwoFactorSetupMutation.isPending}
                        >
                            Cancel setup
                        </Button>
                    </div>
                ) : (
                    <Button
                        onClick={onStartTwoFactor}
                        isLoading={startTwoFactorSetupMutation.isPending}
                    >
                        Set up 2FA
                    </Button>
                )}
            </div>

            {/* ── Recovery Codes ── */}
            {profileQuery.data?.twoFactorEnabled ? (
                <div className="rounded-lg border border-border bg-card p-6">
                    <h3 className="text-sm font-semibold mb-1">Recovery Codes</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                        Recovery codes let you access your account if you lose your authenticator.
                        {recoveryCodeCountQuery.data !== undefined && (
                            <span className="ml-1 font-medium text-foreground">
                                {recoveryCodeCountQuery.data.remaining} unused code{recoveryCodeCountQuery.data.remaining !== 1 ? "s" : ""} remaining.
                            </span>
                        )}
                    </p>

                    {showRecoveryCodes ? (
                        <div className="space-y-3">
                            <div className="rounded-md border border-border bg-muted/30 p-4 font-mono text-xs grid grid-cols-2 gap-1.5">
                                {showRecoveryCodes.map((code) => (
                                    <span key={code} className="select-all">{code}</span>
                                ))}
                            </div>
                            <p className="text-xs text-amber-500">Save these codes now. They won&apos;t be shown again.</p>
                            <Button size="sm" variant="outline" onClick={() => setShowRecoveryCodes(null)}>
                                I&apos;ve saved my codes
                            </Button>
                        </div>
                    ) : (
                        <Form {...twoFactorDisableForm}>
                            <form
                                onSubmit={twoFactorDisableForm.handleSubmit(async (data) => {
                                    regenerateRecoveryCodesMutation.mutate(
                                        { code: data.code },
                                        {
                                            onSuccess: (result) => {
                                                setShowRecoveryCodes(result.recoveryCodes);
                                                twoFactorDisableForm.reset({ code: "" });
                                                void recoveryCodeCountQuery.refetch();
                                                toast.success("Recovery codes regenerated");
                                            },
                                            onError: (e) => toast.error(e.message),
                                        },
                                    );
                                })}
                                className="flex gap-3"
                            >
                                <FormField
                                    control={twoFactorDisableForm.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder="Authenticator code to regenerate" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button variant="outline" size="sm" type="submit" isLoading={regenerateRecoveryCodesMutation.isPending}>
                                    Regenerate
                                </Button>
                            </form>
                        </Form>
                    )}
                </div>
            ) : null}
        </div>
    );
}
