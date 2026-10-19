"use client";

import { AdminPageHeader } from "../_components/admin-page-header";
import AddSesConfiguration from "./add-ses-configuration";
import SesConfigurations from "./ses-configurations";

export default function AdminSesPage() {
  return (
    <>
      <AdminPageHeader
        title="SES regions"
        description="AWS SES regions ByteSend sends through, with their callback and quota settings"
        actions={<AddSesConfiguration />}
      />
      <SesConfigurations />
    </>
  );
}
