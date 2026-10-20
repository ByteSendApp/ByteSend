import { DomainStatus } from "@prisma/client";
import { DomainStatusBadge } from "../domain-badge";

export const DnsStatusBadge: React.FC<{ status: DomainStatus }> = ({ status }) => <DomainStatusBadge status={status} />;
