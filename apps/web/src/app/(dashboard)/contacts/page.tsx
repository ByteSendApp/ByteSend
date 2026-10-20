"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import AddContactBook from "./add-contact-book";
import ContactBooksList from "./contact-books-list";

export default function ContactsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        description="Lists of people you send campaigns and broadcasts to. Each list keeps its own subscribers and unsubscribes."
        actions={<AddContactBook />}
      />
      <ContactBooksList />
    </div>
  );
}
