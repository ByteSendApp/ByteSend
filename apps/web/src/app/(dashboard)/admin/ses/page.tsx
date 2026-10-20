"use client";

import { AdminPageHeader } from "../_components/admin-page-header";
import AddSesConfiguration from "./add-ses-configuration";
import CallbackDiagnostics from "./callback-diagnostics";
import SesConfigurations from "./ses-configurations";
import InboundSetup from "./inbound-setup";

export default function AdminSesPage() {
  return (
    <>
      <AdminPageHeader
        title="SES regions"
        description="AWS SES regions ByteSend sends through, with their callback and quota settings"
        actions={<AddSesConfiguration />}
      />
      <SesConfigurations />
      <InboundSetup />
      <CallbackDiagnostics />
    </>
  );
}
