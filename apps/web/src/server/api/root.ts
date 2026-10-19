import { domainRouter } from "~/server/api/routers/domain";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { apiRouter } from "./routers/api";
import { emailRouter } from "./routers/email";
import { teamRouter } from "./routers/team";
import { adminRouter } from "./routers/admin";
import { contactsRouter } from "./routers/contacts";
import { campaignRouter } from "./routers/campaign";
import { templateRouter } from "./routers/template";
import { billingRouter } from "./routers/billing";
import { invitationRouter } from "./routers/invitiation";
import { dashboardRouter } from "./routers/dashboard";
import { suppressionRouter } from "./routers/suppression";
import { limitsRouter } from "./routers/limits";
import { feedbackRouter } from "./routers/feedback";
import { webhookRouter } from "./routers/webhook";
import { userRouter } from "./routers/user";
import { notificationProviderRouter } from "./routers/notification-provider";
import { logsRouter } from "./routers/logs";

export const appRouter = createTRPCRouter({
  domain: domainRouter,
  apiKey: apiRouter,
  email: emailRouter,
  team: teamRouter,
  admin: adminRouter,
  contacts: contactsRouter,
  campaign: campaignRouter,
  template: templateRouter,
  billing: billingRouter,
  invitation: invitationRouter,
  dashboard: dashboardRouter,
  suppression: suppressionRouter,
  limits: limitsRouter,
  feedback: feedbackRouter,
  webhook: webhookRouter,
  user: userRouter,
  notificationProvider: notificationProviderRouter,
  logs: logsRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
