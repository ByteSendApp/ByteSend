import { NotificationEventType } from "@prisma/client";
import { NotificationProviderService, type NotificationMessage } from "./notification-provider-service";

export class NotificationEmitter {
  static async emitEmailEvent(
    teamId: number,
    status: "sent" | "delivered" | "bounced" | "complained" | "opened" | "clicked",
    data: {
      emailId: string;
      to: string;
      subject?: string;
      timestamp?: Date;
    }
  ) {
    const eventTypeMap: Record<string, NotificationEventType> = {
      sent: "EMAIL_SENT",
      delivered: "EMAIL_DELIVERED",
      bounced: "EMAIL_BOUNCED",
      complained: "EMAIL_COMPLAINED",
      opened: "EMAIL_OPENED",
      clicked: "EMAIL_CLICKED",
    };

    const colorMap: Record<string, string> = {
      sent: "#0EA5E9",
      delivered: "#10B981",
      bounced: "#EF4444",
      complained: "#F59E0B",
      opened: "#8B5CF6",
      clicked: "#06B6D4",
    };

    const message: NotificationMessage = {
      title: `Email ${status}`,
      description: `Email to ${data.to}${data.subject ? ` (${data.subject})` : ""}`,
      color: colorMap[status],
      fields: [
        {
          name: "Event",
          value: status.toUpperCase(),
          inline: true,
        },
        {
          name: "Recipient",
          value: data.to,
          inline: true,
        },
        {
          name: "Email ID",
          value: data.emailId,
          inline: false,
        },
        ...(data.subject
          ? [
            {
              name: "Subject",
              value: data.subject,
              inline: false,
            },
          ]
          : []),
      ],
      timestamp: true,
      data,
    };

    await NotificationProviderService.broadcastNotification(
      teamId,
      eventTypeMap[status] || "EMAIL_SENT",
      message
    );
  }

  /**
   * Campaign event notification
   */
  static async emitCampaignEvent(
    teamId: number,
    event: "started" | "completed",
    data: {
      campaignId: string;
      campaignName: string;
      totalContacts?: number;
      sent?: number;
    }
  ) {
    const message: NotificationMessage = {
      title: `Campaign ${event}`,
      description: data.campaignName,
      color: event === "completed" ? "#10B981" : "#0EA5E9",
      fields: [
        {
          name: "Campaign",
          value: data.campaignName,
          inline: false,
        },
        ...(data.totalContacts
          ? [
            {
              name: "Total Contacts",
              value: data.totalContacts.toString(),
              inline: true,
            },
          ]
          : []),
        ...(data.sent
          ? [
            {
              name: "Sent",
              value: data.sent.toString(),
              inline: true,
            },
          ]
          : []),
      ],
      timestamp: true,
      data,
    };

    await NotificationProviderService.broadcastNotification(
      teamId,
      event === "completed" ? "CAMPAIGN_COMPLETED" : "CAMPAIGN_STARTED",
      message
    );
  }

  /**
   * Domain event notification
   */
  static async emitDomainEvent(
    teamId: number,
    data: {
      domainName: string;
      status: "verified" | "failed" | "pending";
      error?: string;
    }
  ) {
    const statusMap: Record<string, string> = {
      verified: "#10B981",
      failed: "#EF4444",
      pending: "#F59E0B",
    };

    const message: NotificationMessage = {
      title: `Domain ${data.status}`,
      description: data.domainName,
      color: statusMap[data.status],
      fields: [
        {
          name: "Domain",
          value: data.domainName,
          inline: false,
        },
        {
          name: "Status",
          value: data.status.toUpperCase(),
          inline: true,
        },
        ...(data.error
          ? [
            {
              name: "Error",
              value: data.error,
              inline: false,
            },
          ]
          : []),
      ],
      timestamp: true,
      data,
    };

    await NotificationProviderService.broadcastNotification(
      teamId,
      "DOMAIN_VERIFIED",
      message
    );
  }

  /**
   * Contact event notification
   */
  static async emitContactEvent(
    teamId: number,
    event: "created" | "deleted",
    data: {
      contactEmail: string;
      contactBookName?: string;
      count?: number;
    }
  ) {
    const message: NotificationMessage = {
      title: `Contact ${event}`,
      description: data.contactEmail,
      color: event === "created" ? "#10B981" : "#F59E0B",
      fields: [
        {
          name: "Email",
          value: data.contactEmail,
          inline: false,
        },
        ...(data.contactBookName
          ? [
            {
              name: "Contact Book",
              value: data.contactBookName,
              inline: true,
            },
          ]
          : []),
        ...(data.count
          ? [
            {
              name: "Count",
              value: data.count.toString(),
              inline: true,
            },
          ]
          : []),
      ],
      timestamp: true,
      data,
    };

    await NotificationProviderService.broadcastNotification(
      teamId,
      event === "created" ? "CONTACT_CREATED" : "CONTACT_DELETED",
      message
    );
  }

  /**
   * Error alert notification
   */
  static async emitErrorAlert(
    teamId: number,
    data: {
      title: string;
      message: string;
      errorCode?: string;
      context?: Record<string, unknown>;
    }
  ) {
    const notificationMessage: NotificationMessage = {
      title: "🚨 Error Alert",
      description: data.title,
      color: "#EF4444",
      fields: [
        {
          name: "Error",
          value: data.message,
          inline: false,
        },
        ...(data.errorCode
          ? [
            {
              name: "Error Code",
              value: data.errorCode,
              inline: true,
            },
          ]
          : []),
      ],
      timestamp: true,
      data: {
        ...data.context,
        errorCode: data.errorCode,
      },
    };

    await NotificationProviderService.broadcastNotification(
      teamId,
      "ERROR_ALERT",
      notificationMessage
    );
  }
}

/**
 * Example integration with webhook service
 * Add this to your webhook service emit method:
 *
 * // After creating webhook calls in WebhookService.emit
 * if (type === 'email.delivered') {
 *   NotificationEmitter.emitEmailEvent(teamId, 'delivered', {
 *     emailId: payload.data.emailId,
 *     to: payload.data.to,
 *     subject: payload.data.subject,
 *   });
 * }
 */
