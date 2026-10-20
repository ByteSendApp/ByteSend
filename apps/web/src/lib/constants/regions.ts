export const REGION_INFO: Record<string, { label: string; short: string; country: string }> = {
  "us-east-1": { label: "US East (N. Virginia)", short: "US East", country: "us" },
  "us-east-2": { label: "US East (Ohio)", short: "US East 2", country: "us" },
  "us-west-1": { label: "US West (N. California)", short: "US West", country: "us" },
  "us-west-2": { label: "US West (Oregon)", short: "US West 2", country: "us" },
  "ca-central-1": { label: "Canada (Central)", short: "Canada", country: "ca" },
  "eu-west-1": { label: "Europe (Ireland)", short: "Ireland", country: "ie" },
  "eu-west-2": { label: "Europe (London)", short: "London", country: "gb" },
  "eu-west-3": { label: "Europe (Paris)", short: "Paris", country: "fr" },
  "eu-central-1": { label: "Europe (Frankfurt)", short: "Frankfurt", country: "de" },
  "eu-north-1": { label: "Europe (Stockholm)", short: "Stockholm", country: "se" },
  "eu-south-1": { label: "Europe (Milan)", short: "Milan", country: "it" },
  "ap-south-1": { label: "Asia Pacific (Mumbai)", short: "Mumbai", country: "in" },
  "ap-northeast-1": { label: "Asia Pacific (Tokyo)", short: "Tokyo", country: "jp" },
  "ap-northeast-2": { label: "Asia Pacific (Seoul)", short: "Seoul", country: "kr" },
  "ap-northeast-3": { label: "Asia Pacific (Osaka)", short: "Osaka", country: "jp" },
  "ap-southeast-1": { label: "Asia Pacific (Singapore)", short: "Singapore", country: "sg" },
  "ap-southeast-2": { label: "Asia Pacific (Sydney)", short: "Sydney", country: "au" },
  "sa-east-1": { label: "South America (São Paulo)", short: "São Paulo", country: "br" },
  "me-south-1": { label: "Middle East (Bahrain)", short: "Bahrain", country: "bh" },
  "af-south-1": { label: "Africa (Cape Town)", short: "Cape Town", country: "za" },
};

export function regionLabel(region: string): string {
  return REGION_INFO[region]?.label ?? region;
}
