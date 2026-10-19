# bytesend-go

The official Go SDK for [ByteSend](https://bytesend.cloud): a transactional email and campaign platform.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [Services](#services)
  - [Emails](#emails)
  - [Contacts](#contacts)
  - [Contact Books](#contact-books)
  - [Domains](#domains)
  - [Campaigns](#campaigns)
  - [Analytics](#analytics)

## Installation

```sh
go get github.com/ByteSendApp/ByteSend/packages/go-sdk
```

Requires Go 1.21+.

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    bytesend "github.com/ByteSendApp/ByteSend/packages/go-sdk"
)

func main() {
    client, err := bytesend.NewClient("bs_your_api_key")
    if err != nil {
        log.Fatal(err)
    }

    resp, err := client.Emails.Create(context.Background(), bytesend.SendEmailPayload{
        From:    "Acme <hello@acme.com>",
        To:      []string{"user@example.com"},
        Subject: "Welcome!",
        HTML:    "<h1>Hello!</h1>",
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Sent:", resp.EmailID)
}
```

## Configuration

### API Key

The API key can be passed directly or read automatically from the `BYTESEND_API_KEY` environment variable:

```go
// Explicit key
client, err := bytesend.NewClient("bs_your_api_key")

// From environment variable (pass empty string)
client, err := bytesend.NewClient("")
```

### Client Options

```go
import (
    "net/http"
    "time"
)

client, err := bytesend.NewClient("bs_your_api_key",
    // Override the base URL (useful for testing/proxying)
    bytesend.WithBaseURL("https://your-proxy.example.com/api/v1"),

    // Supply your own HTTP client (custom timeouts, transport, etc.)
    bytesend.WithHTTPClient(&http.Client{Timeout: 60 * time.Second}),
)
```

## Error Handling

All service methods return a single `error`. API errors are returned as `*ErrorResponse`, which implements the `error` interface. Use `errors.As` to inspect the API error code:

```go
import "errors"

resp, err := client.Emails.Create(ctx, payload)
if err != nil {
    var apiErr *bytesend.ErrorResponse
    if errors.As(err, &apiErr) {
        fmt.Println("API error code:", apiErr.Code)
        fmt.Println("API error message:", apiErr.Message)
    } else {
        // Network or encoding error
        log.Fatal(err)
    }
}
```

## Services

### Emails

#### Send an email

```go
resp, err := client.Emails.Create(ctx, bytesend.SendEmailPayload{
    From:    "Acme <hello@acme.com>",
    To:      []string{"user@example.com"},
    Subject: "Hello!",
    HTML:    "<h1>Hello!</h1>",
    Text:    "Hello!",
})
// resp.EmailID
```

#### Send with idempotency key

Passing an idempotency key prevents duplicate sends on retry. The same key + same body returns the original `emailId` without re-sending. The same key + a different body returns an error with code `NOT_UNIQUE`. Keys expire after 24 hours.

```go
resp, err := client.Emails.Create(ctx, payload, "order-12345")
```

#### Send with attachments

```go
content, _ := os.ReadFile("invoice.pdf")

resp, err := client.Emails.Create(ctx, bytesend.SendEmailPayload{
    From:    "Acme <hello@acme.com>",
    To:      []string{"user@example.com"},
    Subject: "Your invoice",
    HTML:    "<p>Please find your invoice attached.</p>",
    Attachments: []bytesend.Attachment{
        {Filename: "invoice.pdf", Content: content},
    },
})
```

#### Send with a template

```go
resp, err := client.Emails.Create(ctx, bytesend.SendEmailPayload{
    From:       "Acme <hello@acme.com>",
    To:         []string{"user@example.com"},
    TemplateID: "tmpl_abc123",
    Variables:  map[string]string{"name": "Jane", "plan": "Pro"},
})
```

#### Batch send (up to 100 emails)

```go
resp, err := client.Emails.Batch(ctx, []bytesend.SendEmailPayload{
    {From: "hello@acme.com", To: []string{"a@example.com"}, Subject: "Hi A", HTML: "<p>Hi A</p>"},
    {From: "hello@acme.com", To: []string{"b@example.com"}, Subject: "Hi B", HTML: "<p>Hi B</p>"},
}, "batch-idempotency-key") // idempotency key is optional
// resp.Data: []CreateEmailResponse
```

#### List emails

```go
resp, err := client.Emails.List(ctx, bytesend.ListEmailsParams{
    Page:      "1",
    Limit:     "50",
    StartDate: "2026-01-01T00:00:00Z",
    EndDate:   "2026-01-31T23:59:59Z",
    DomainID:  "123",
})
// resp.Data : []EmailSummary
// resp.Count: total number of emails
```

#### Get a single email

```go
email, err := client.Emails.Get(ctx, "em_abc123")
// email.EmailEvents: full delivery event history
```

#### Reschedule a scheduled email

```go
resp, err := client.Emails.Update(ctx, "em_abc123", bytesend.UpdateEmailPayload{
    ScheduledAt: "2026-06-01T09:00:00Z",
})
```

#### Cancel a scheduled email

```go
resp, err := client.Emails.Cancel(ctx, "em_abc123")
```

---

### Contacts

#### Create a contact

```go
subscribed := true
resp, err := client.Contacts.Create(ctx, "cb_bookid", bytesend.CreateContactPayload{
    Email:      "user@example.com",
    FirstName:  "Jane",
    LastName:   "Doe",
    Subscribed: &subscribed,
    Properties: map[string]string{"plan": "pro"},
})
// resp.ContactID
```

#### List contacts

```go
contacts, err := client.Contacts.List(ctx, "cb_bookid", bytesend.ListContactsParams{
    Page:  "1",
    Limit: "100",
    // Emails: "a@example.com,b@example.com": filter by email addresses
    // IDs:    "ct_1,ct_2"                  : filter by contact IDs
})
```

#### Get a contact

```go
contact, err := client.Contacts.Get(ctx, "cb_bookid", "ct_contactid")
```

#### Update a contact

```go
resp, err := client.Contacts.Update(ctx, "cb_bookid", "ct_contactid", bytesend.UpdateContactPayload{
    FirstName: "Jane",
})
```

#### Upsert a contact

Creates the contact if it doesn't exist, updates it if it does.

```go
resp, err := client.Contacts.Upsert(ctx, "cb_bookid", "ct_contactid", bytesend.CreateContactPayload{
    Email: "user@example.com",
})
```

#### Delete a contact

```go
resp, err := client.Contacts.Delete(ctx, "cb_bookid", "ct_contactid")
// resp.Success
```

#### Bulk create contacts (up to 1,000)

```go
resp, err := client.Contacts.BulkCreate(ctx, "cb_bookid", []bytesend.CreateContactPayload{
    {Email: "a@example.com", FirstName: "Alice"},
    {Email: "b@example.com", FirstName: "Bob"},
})
// resp.Count: number of contacts created
```

#### Bulk delete contacts (up to 1,000)

```go
resp, err := client.Contacts.BulkDelete(ctx, "cb_bookid", bytesend.BulkDeleteContactsPayload{
    ContactIDs: []string{"ct_1", "ct_2"},
})
// resp.Count: number of contacts deleted
```

---

### Contact Books

#### List contact books

```go
books, err := client.ContactBooks.List(ctx)
// books: []ContactBook, each with books[i].Count.Contacts
```

#### Create a contact book

```go
book, err := client.ContactBooks.Create(ctx, bytesend.CreateContactBookPayload{
    Name:      "Newsletter",
    Emoji:     "📬",
    Variables: []string{"firstName", "company"},
})
```

#### Get a contact book

```go
book, err := client.ContactBooks.Get(ctx, "cb_bookid")
// book.Count.Contacts: total contact count
```

#### Update a contact book

```go
book, err := client.ContactBooks.Update(ctx, "cb_bookid", bytesend.UpdateContactBookPayload{
    Name: "Weekly Newsletter",
})
```

#### Enable double opt-in

```go
enabled := true
book, err := client.ContactBooks.Update(ctx, "cb_bookid", bytesend.UpdateContactBookPayload{
    DoubleOptInEnabled: &enabled,
    DoubleOptInFrom:    "Newsletter <hello@acme.com>",
    DoubleOptInSubject: "Please confirm your subscription",
})
```

#### Delete a contact book

```go
resp, err := client.ContactBooks.Delete(ctx, "cb_bookid")
// resp.Success
```

---

### Domains

#### List domains

```go
domains, err := client.Domains.List(ctx)
```

#### Create a domain

```go
domain, err := client.Domains.Create(ctx, bytesend.CreateDomainPayload{
    Name:   "mail.acme.com",
    Region: "us-east-1",
})
// domain.DNSRecords: DNS records to add at your DNS provider
```

#### Get a domain

```go
domain, err := client.Domains.Get(ctx, "1")
// domain.Status: NOT_STARTED | PENDING | SUCCESS | FAILED | TEMPORARY_FAILURE
```

#### Verify a domain

Triggers a DNS verification check.

```go
resp, err := client.Domains.Verify(ctx, "1")
// resp.Message
```

#### Delete a domain

```go
resp, err := client.Domains.Delete(ctx, "1")
// resp.Success
```

---

### Campaigns

#### Create a campaign

```go
campaign, err := client.Campaigns.Create(ctx, bytesend.CreateCampaignPayload{
    Name:          "May Newsletter",
    From:          "Acme <hello@acme.com>",
    Subject:       "What's new in May",
    ContactBookID: "cb_bookid",
    HTML:          "<h1>Hello from Acme!</h1>",
    PreviewText:   "Here's what's new this month",
})
```

#### Create and send immediately

```go
campaign, err := client.Campaigns.Create(ctx, bytesend.CreateCampaignPayload{
    Name:          "Flash Sale",
    From:          "Acme <hello@acme.com>",
    Subject:       "Flash sale: 24 hours only",
    ContactBookID: "cb_bookid",
    HTML:          "<p>Sale is live!</p>",
    SendNow:       true,
})
```

#### List campaigns

```go
resp, err := client.Campaigns.List(ctx, bytesend.ListCampaignsParams{
    Page:   "1",
    Status: "DRAFT", // DRAFT | SCHEDULED | RUNNING | PAUSED | SENT
    Search: "newsletter",
})
// resp.Campaigns: []CampaignSummary
// resp.TotalPage
```

#### Get a campaign

```go
campaign, err := client.Campaigns.Get(ctx, "cmp_123")
// campaign.Sent, campaign.Delivered, campaign.Opened, campaign.Clicked, ...
```

#### Schedule a campaign

```go
resp, err := client.Campaigns.Schedule(ctx, "cmp_123", bytesend.ScheduleCampaignPayload{
    ScheduledAt: "2026-06-01T09:00:00Z",
    BatchSize:   500, // emails per batch window
})
```

#### Pause a campaign

```go
resp, err := client.Campaigns.Pause(ctx, "cmp_123")
// resp.Success
```

#### Resume a campaign

```go
resp, err := client.Campaigns.Resume(ctx, "cmp_123")
// resp.Success
```

#### Delete a campaign

```go
campaign, err := client.Campaigns.Delete(ctx, "cmp_123")
```

---

### Analytics

#### Email time series

Returns per-day send, delivery, and engagement counts for the last 7 or 30 days.

```go
resp, err := client.Analytics.EmailTimeSeries(ctx, bytesend.EmailTimeSeriesParams{
    Days:     "30", // "7" or "30"
    DomainID: "123",
})
// resp.Result     : []EmailTimeSeriesEntry{Date, Sent, Delivered, Opened, Clicked, Bounced, Complained}
// resp.TotalCounts: EmailTotals (aggregate over the period)
```

#### Reputation metrics

```go
resp, err := client.Analytics.ReputationMetrics(ctx, bytesend.ReputationMetricsParams{
    DomainID: "123",
})
// resp.BounceRate    float64
// resp.ComplaintRate float64
// resp.HardBounced   int
```

## License

[AGPL-3.0](LICENSE) © [NodeByte LTD](https://nodebyte.co.uk)
