"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { PageHeader } from "@bytesend/ui/src/page-header";
import AddSuppressionDialog from "./add-suppression";
import BulkAddSuppressionsDialog from "./bulk-add-suppressions";
import SuppressionList from "./suppression-list";
import SuppressionStats from "./suppression-stats";

export default function SuppressionsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suppressions"
        description="Addresses ByteSend won't send to: ones that bounced, complained, or that you added. This protects your sending reputation."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowBulkAddDialog(true)}>
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="size-3.5" />
              Add address
            </Button>
          </>
        }
      />
      <SuppressionStats />
      <SuppressionList />
      <AddSuppressionDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      <BulkAddSuppressionsDialog open={showBulkAddDialog} onOpenChange={setShowBulkAddDialog} />
    </div>
  );
}
