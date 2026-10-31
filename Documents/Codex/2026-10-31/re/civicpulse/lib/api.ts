import type { CivicIssue } from "@/lib/issues";

const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

type ApiIssue = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: CivicIssue["status"];
  latitude: number | null;
  longitude: number | null;
};

export type CampaignPledge = {
  id: string;
  display_name: string;
  amount: number;
  thank_you_note: string;
  created_at: string;
  kind: "Pledge intent";
};

export type ApiCampaign = {
  id: string;
  issue_id: string;
  purpose: string;
  target: number;
  deadline: string;
  executor: string;
  plan: string;
  created_at: string;
  contributions: CampaignPledge[];
};

export type AreaLookupResponse = {
  area_name: string;
  district: string | null;
  ward: string | null;
  city_match: boolean;
  authority: { name: string; phone: string | null; portal: string; confidence: string; caveat: string } | null;
  area_note: string;
  ai_summary: string | null;
  ai_label: string;
  sources: { id: string; title: string; publisher: string; url: string; checked_at: string; retrieved_live: boolean }[];
};

export async function getAreaLookup(input: { description: string; category: string; latitude: number; longitude: number }): Promise<AreaLookupResponse> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/v1/area-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(`CivicPulse API is unreachable at ${apiBase}. Start it with “docker compose up --build”, then retry. If it is already running, check NEXT_PUBLIC_API_URL and that CORS_ORIGINS matches this page's address.`);
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail || "Authority lookup could not complete. Please try again.");
  }
  return await response.json() as AreaLookupResponse;
}

function fromApi(issue: ApiIssue): CivicIssue {
  const position = issue.latitude !== null && issue.longitude !== null
    ? [issue.latitude, issue.longitude] as [number, number]
    : undefined;
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    category: issue.category,
    status: issue.status,
    location: position ? "Coordinates attached" : "Location not provided",
    demo: false,
    ...(position ? { position } : {}),
  };
}

export async function listIssues(): Promise<CivicIssue[]> {
  const response = await fetch(`${apiBase}/api/v1/issues`, { cache: "no-store" });
  if (!response.ok) throw new Error("Issue service is unavailable");
  const issues = await response.json() as ApiIssue[];
  return issues.map(fromApi);
}

export async function saveIssue(issue: {
  title: string;
  description: string;
  category: string;
  severity: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<CivicIssue> {
  const response = await fetch(`${apiBase}/api/v1/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(issue),
  });
  if (!response.ok) throw new Error("Issue could not be saved to the API");
  return fromApi(await response.json() as ApiIssue);
}

export async function getCampaign(issueId: string): Promise<ApiCampaign | null> {
  const response = await fetch(`${apiBase}/api/v1/campaigns/${encodeURIComponent(issueId)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Campaign service is unavailable");
  return await response.json() as ApiCampaign;
}

export async function createCampaign(campaign: {
  issue_id: string;
  purpose: string;
  target: number;
  deadline: string;
  executor: string;
  plan: string;
}): Promise<ApiCampaign> {
  const response = await fetch(`${apiBase}/api/v1/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(campaign),
  });
  if (!response.ok) throw new Error("Campaign could not be published to the shared API");
  return await response.json() as ApiCampaign;
}

export async function addCampaignPledge(issueId: string, pledge: { display_name: string; amount: number }): Promise<CampaignPledge> {
  const response = await fetch(`${apiBase}/api/v1/campaigns/${encodeURIComponent(issueId)}/contributions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pledge),
  });
  if (!response.ok) throw new Error("Pledge intent could not be saved to the shared campaign");
  return await response.json() as CampaignPledge;
}
