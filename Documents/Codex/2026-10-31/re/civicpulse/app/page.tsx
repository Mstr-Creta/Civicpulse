"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Check, Copy, Heart, LocateFixed, MapPin, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { issueCategories, sampleIssues, type CivicIssue, type IssueStatus } from "@/lib/issues";
import { addCampaignPledge, createCampaign, getAreaLookup, getCampaign, listIssues, saveIssue, type ApiCampaign, type AreaLookupResponse, type CampaignPledge } from "@/lib/api";

const IssueMap = dynamic(() => import("@/components/issue-map"), {
  ssr: false,
  loading: () => <div className="map-frame" aria-label="Loading map"><div className="map-loading">Loading map…</div></div>,
});

const STORAGE_KEY = "civicpulse.local-issues.v1";
const CAMPAIGN_KEY = "civicpulse.local-campaigns.v1";

type LocalCampaign = { id: string; issueId: string; purpose: string; target: number; deadline: string; executor: string; plan: string; contributions: CampaignPledge[]; source: "local" | "shared" };

function AreaLookupCard({ result, loading, error, disabled, onLookup }: {
  result: AreaLookupResponse | null;
  loading: boolean;
  error: string;
  disabled: boolean;
  onLookup: () => void;
}) {
  return <section className="authority-panel" aria-label="Area and authority lookup">
    <div className="authority-heading"><div><h3>Area &amp; authority lookup</h3><p>Resolve the location and check official Bhubaneswar civic sources.</p></div><span className="authority-source-badge">Official sources</span></div>
    {loading && <p className="authority-status" role="status">Checking the area and asking Gemma to summarize the official guidance…</p>}
    {error && <p className="authority-error" role="alert">{error}</p>}
    {result && <div className="authority-result">
      <p className="authority-area"><MapPin size={15} aria-hidden="true" />{result.area_name}{result.district ? ` · ${result.district}` : ""}{result.ward ? ` · ${result.ward}` : ""}</p>
      {result.authority ? <div className="authority-contact"><strong>{result.authority.name}</strong><span>{result.authority.confidence}</span><p>{result.authority.caveat}</p>{result.authority.phone && <a href={`tel:${result.authority.phone.split("·")[0].trim().replace(/\s/g, "")}`}>{result.authority.phone}</a>}</div> : <p className="authority-outside">{result.area_note}</p>}
      {result.ai_summary && <div className="authority-ai"><strong>{result.ai_label}</strong><p>{result.ai_summary}</p></div>}
      {!result.ai_summary && result.authority && <p className="authority-status">Gemma summary is unavailable right now. The source-backed contacts are still shown.</p>}
      <p className="authority-caveat">{result.area_note}</p>
      <ul className="authority-sources">{result.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={13} aria-hidden="true" /></a><small>{source.publisher} · {source.retrieved_live ? `page fetched ${source.checked_at}` : `source page unavailable; reviewed ${source.checked_at}`}</small></li>)}</ul>
      <small className="authority-attribution">Location resolved with <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap Nominatim</a>. Verify jurisdiction and contact details on official sites. No employee has been identified. <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">Nominatim usage policy</a>.</small>
    </div>}
    <button className="btn authority-button" type="button" onClick={onLookup} disabled={disabled || loading}>{loading ? "Looking up…" : result ? "Refresh lookup" : disabled ? "Attach a location first" : "Find area & authority"}</button>
    <p className="authority-privacy">When you request a lookup, the selected coordinates are sent to OpenStreetMap Nominatim.</p>
  </section>;
}

function fromApiCampaign(campaign: ApiCampaign): LocalCampaign {
  return { id: campaign.id, issueId: campaign.issue_id, purpose: campaign.purpose, target: campaign.target, deadline: campaign.deadline, executor: campaign.executor, plan: campaign.plan, contributions: campaign.contributions, source: "shared" };
}

function readCampaigns(): LocalCampaign[] {
  try {
    const value = window.localStorage.getItem(CAMPAIGN_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: Record<string, unknown>) => ({
      id: typeof item.id === "string" ? item.id : `local-${String(item.issueId ?? "campaign")}`,
      issueId: String(item.issueId ?? ""),
      purpose: String(item.purpose ?? ""),
      target: Number(item.target ?? 0),
      deadline: String(item.deadline ?? ""),
      executor: String(item.executor ?? ""),
      plan: String(item.plan ?? ""),
      contributions: Array.isArray(item.contributions) ? item.contributions as CampaignPledge[] : [],
      source: item.source === "shared" ? "shared" as const : "local" as const,
    })).filter((item: LocalCampaign) => item.issueId && item.purpose);
  } catch { return []; }
}

function readLocalIssues(): CivicIssue[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as CivicIssue[] : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const [localIssues, setLocalIssues] = useState<CivicIssue[]>([]);
  const [serverIssues, setServerIssues] = useState<CivicIssue[]>([]);
  const [apiOnline, setApiOnline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All statuses");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [formError, setFormError] = useState("");
  const [areaLookup, setAreaLookup] = useState<AreaLookupResponse | null>(null);
  const [areaLookupLoading, setAreaLookupLoading] = useState(false);
  const [areaLookupError, setAreaLookupError] = useState("");
  const [campaigns, setCampaigns] = useState<LocalCampaign[]>([]);
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);

  useEffect(() => {
    setLocalIssues(readLocalIssues());
    setCampaigns(readCampaigns());
    try { setConfirmedIds(JSON.parse(window.localStorage.getItem("civicpulse.confirmations.v1") ?? "[]")); } catch { setConfirmedIds([]); }
    setHydrated(true);
    listIssues().then((items) => {
      setServerIssues(items);
      setApiOnline(true);
    }).catch(() => setApiOnline(false));
  }, []);

  useEffect(() => {
    setAreaLookup(null);
    setAreaLookupError("");
  }, [selectedId]);

  const issues = useMemo(() => [...localIssues, ...serverIssues, ...sampleIssues], [localIssues, serverIssues]);
  const visibleIssues = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return issues.filter((issue) => {
      const matchesQuery = !needle || `${issue.title} ${issue.description} ${issue.category} ${issue.location}`.toLowerCase().includes(needle);
      const matchesCategory = category === "All categories" || issue.category === category;
      const matchesStatus = status === "All statuses" || issue.status === status;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [issues, query, category, status]);
  const selectedIssue = issues.find((issue) => issue.id === selectedId);

  useEffect(() => {
    if (!selectedId || !apiOnline) return;
    getCampaign(selectedId).then((campaign) => {
      if (!campaign) return;
      const shared = fromApiCampaign(campaign);
      setCampaigns((current) => [shared, ...current.filter((item) => item.issueId !== selectedId)]);
    }).catch(() => undefined);
  }, [selectedId, apiOnline]);

  function recordConfirmation(issue: CivicIssue) {
    const next = [...new Set([...confirmedIds, issue.id])];
    setConfirmedIds(next);
    window.localStorage.setItem("civicpulse.confirmations.v1", JSON.stringify(next));
    setMessage("Your confirmation is saved on this device. It does not change the community status.");
    window.setTimeout(() => setMessage(""), 5000);
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>, issue: CivicIssue) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      issue_id: issue.id,
      issueId: issue.id,
      purpose: String(data.get("purpose") ?? "").trim(),
      target: Number(data.get("target")),
      deadline: String(data.get("deadline") ?? ""),
      executor: String(data.get("executor") ?? "").trim(),
      plan: String(data.get("plan") ?? "").trim(),
    };
    const localCampaign: LocalCampaign = { ...input, id: `local-${issue.id}`, contributions: [], source: "local" };
    setCampaignSaving(true);
    try {
      if (!apiOnline) throw new Error("API offline");
      const shared = fromApiCampaign(await createCampaign({ issue_id: input.issue_id, purpose: input.purpose, target: input.target, deadline: input.deadline, executor: input.executor, plan: input.plan }));
      const next = [shared, ...campaigns.filter((item) => item.issueId !== issue.id)];
      setCampaigns(next);
      window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(next));
      setCampaignMessage("Campaign published to the shared community. It is not a payment page.");
    } catch {
      if (apiOnline) {
        const alreadyPublished = await getCampaign(issue.id).catch(() => null);
        if (alreadyPublished) {
          const shared = fromApiCampaign(alreadyPublished);
          const next = [shared, ...campaigns.filter((item) => item.issueId !== issue.id)];
          setCampaigns(next);
          window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(next));
          setCampaignMessage("A shared campaign already exists for this issue. Showing its public supporter list.");
          setCampaignSaving(false);
          return;
        }
      }
      const next = [localCampaign, ...campaigns.filter((item) => item.issueId !== issue.id)];
      setCampaigns(next);
      window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(next));
      setCampaignMessage("Saved on this device only. Start the API to publish it for everyone.");
    } finally { setCampaignSaving(false); }
  }

  async function addPledge(event: FormEvent<HTMLFormElement>, campaign: LocalCampaign) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = Number(data.get("amount"));
    const displayName = String(data.get("display_name") ?? "").trim();
    if (!Number.isFinite(amount) || amount <= 0) return;
    const form = event.currentTarget;
    setCampaignSaving(true);
    try {
      if (campaign.source === "shared") {
        await addCampaignPledge(campaign.issueId, { display_name: displayName, amount });
        const refreshed = await getCampaign(campaign.issueId);
        if (refreshed) {
          const next = [fromApiCampaign(refreshed), ...campaigns.filter((item) => item.issueId !== campaign.issueId)];
          setCampaigns(next);
          window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(next));
        }
        setCampaignMessage(`Thank you, ${displayName}. Your pledge and thank-you note are visible to everyone on this shared campaign.`);
      } else {
        const contribution: CampaignPledge = { id: crypto.randomUUID(), display_name: displayName, amount, thank_you_note: `Thank you, ${displayName}, for pledging ₹${amount.toLocaleString("en-IN")} toward ${campaign.purpose}.`, created_at: new Date().toISOString(), kind: "Pledge intent" };
        const next = campaigns.map((item) => item.issueId === campaign.issueId ? { ...item, contributions: [contribution, ...item.contributions] } : item);
        setCampaigns(next);
        window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(next));
        setCampaignMessage(`Thank you, ${displayName}. Your pledge is saved on this device; it is not shared yet.`);
      }
      form.reset();
    } catch {
      setCampaignMessage("Could not save this pledge. Check that the API is running, then try again.");
    } finally { setCampaignSaving(false); }
  }

  async function publishLocalCampaign(campaign: LocalCampaign) {
    setCampaignSaving(true);
    try {
      const shared = fromApiCampaign(await createCampaign({ issue_id: campaign.issueId, purpose: campaign.purpose, target: campaign.target, deadline: campaign.deadline, executor: campaign.executor, plan: campaign.plan }));
      const next = [shared, ...campaigns.filter((item) => item.issueId !== campaign.issueId)];
      setCampaigns(next);
      window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(next));
      setCampaignMessage("Campaign published for everyone. Existing device-only pledge intents were not shared.");
    } catch {
      setCampaignMessage("Could not publish this campaign. Check that the API is running and the issue is still verified.");
    } finally { setCampaignSaving(false); }
  }

  async function copyEscalation(issue: CivicIssue) {
    const draft = `Civic issue report: ${issue.title}\nCategory: ${issue.category}\nLocation: ${issue.location}\n\n${issue.description}\n\nPlease review this report and share the appropriate next step.`;
    try {
      await navigator.clipboard.writeText(draft);
      setMessage("Factual escalation draft copied. Review it and choose the appropriate official channel.");
    } catch { setMessage(draft); }
    window.setTimeout(() => setMessage(""), 6000);
  }

  function openReport() {
    setReportOpen(true);
    setMessage("");
    setFormError("");
    setAreaLookup(null);
    setAreaLookupError("");
    window.setTimeout(() => document.getElementById("report-title")?.focus(), 0);
  }

  async function runAreaLookup(description: string, issueCategory: string, position: [number, number]) {
    setAreaLookupLoading(true);
    setAreaLookupError("");
    setAreaLookup(null);
    try {
      setAreaLookup(await getAreaLookup({ description, category: issueCategory, latitude: position[0], longitude: position[1] }));
    } catch (error) {
      setAreaLookupError(error instanceof Error ? error.message : "Area lookup could not complete.");
    } finally { setAreaLookupLoading(false); }
  }

  function lookupReportArea() {
    if (!location) return;
    const form = document.getElementById("report-form") as HTMLFormElement | null;
    const data = form ? new FormData(form) : null;
    const description = String(data?.get("description") ?? "").trim();
    const issueCategory = String(data?.get("category") ?? "").trim();
    if (description.length < 8 || issueCategory.length < 2) {
      setAreaLookupError("Add a report description and category first so Gemma can make a useful, grounded summary.");
      return;
    }
    void runAreaLookup(description, issueCategory, location);
  }

  function lookupSelectedArea() {
    if (!selectedIssue?.position) return;
    void runAreaLookup(selectedIssue.description, selectedIssue.category, selectedIssue.position);
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setFormError("This browser cannot share a location. You can still submit without it.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation([position.coords.latitude, position.coords.longitude]);
        setFormError("");
      },
      () => setFormError("Location was not shared. You can still submit without it."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const issueCategory = String(data.get("category") ?? "");
    const severity = String(data.get("severity") ?? "");
    if (!title || !description || !issueCategory || !severity) {
      setFormError("Add a title, category, severity and description before saving.");
      return;
    }

    const form = event.currentTarget;
    setSaving(true);
    const issue: CivicIssue = {
      id: `local-${crypto.randomUUID()}`,
      title,
      description,
      category: issueCategory,
      status: "Reported" as IssueStatus,
      location: location ? "Coordinates attached" : "Location not provided",
      demo: false,
      ...(location ? { position: location } : {}),
    };
    try {
      const saved = await saveIssue({
        title, description, category: issueCategory, severity,
        latitude: location?.[0] ?? null,
        longitude: location?.[1] ?? null,
      });
      setServerIssues((current) => [saved, ...current]);
      setApiOnline(true);
      setSelectedId(saved.id);
      setMessage("Saved to the CivicPulse database. It has not been sent to a civic office.");
    } catch {
      const next = [issue, ...localIssues];
      setLocalIssues(next);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSelectedId(issue.id);
      setApiOnline(false);
      setMessage("API unavailable. Saved in this browser only; it has not been sent to a civic office.");
    } finally {
      setSaving(false);
      setQuery("");
      setCategory("All categories");
      setStatus("All statuses");
      setReportOpen(false);
      setLocation(null);
      form.reset();
      window.setTimeout(() => setMessage(""), 6000);
    }
  }

  function clearLocalIssues() {
    setLocalIssues([]);
    window.localStorage.removeItem(STORAGE_KEY);
    setMessage("Your locally saved reports were cleared.");
    window.setTimeout(() => setMessage(""), 4000);
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to issues</a>
      <header className="topbar">
        <a className="brand" href="#main" aria-label="CivicPulse home">
          <span className="brand-mark"><MapPin aria-hidden="true" strokeWidth={2} /></span>
          <span>CivicPulse</span>
        </a>
        <div className="topbar-actions">
          <label className="area-select">
            <MapPin size={16} aria-hidden="true" />
            <span className="visually-hidden">Preview area</span>
            <select aria-label="Preview area" defaultValue="Bhubaneswar, Odisha sample">
              <option>Bhubaneswar, Odisha sample</option>
              <option disabled>Choose your city, coming next</option>
            </select>
          </label>
          <button className="btn btn-primary topbar-report" type="button" onClick={openReport}>
            <Plus size={17} aria-hidden="true" /><span>Report an issue</span>
          </button>
        </div>
      </header>

      <main className="main" id="main">
        <section className="masthead">
          <div className="heading-copy">
            <p className="masthead-place">Bhubaneswar, Odisha <span>Community issue board</span></p>
            <h1>See what needs attention.</h1>
            <p className="hero-lead">Report what you see. Follow what happens next.</p>
            <div className="masthead-actions">
              <button className="btn btn-primary masthead-report" type="button" onClick={openReport}><Plus size={17} aria-hidden="true" /> Report an issue</button>
              <a className="text-action" href="#issue-board">Browse the board <ArrowUpRight size={17} aria-hidden="true" /></a>
            </div>
            <p className="hero-note">A shared record for reports, updates, and community support.</p>
          </div>
          <aside className="hero-map-panel" aria-labelledby="hero-map-heading">
            <div className="hero-map-head"><div><h2 id="hero-map-heading">On the map</h2><p>Bhubaneswar, Odisha</p></div><span className="tag tag-demo">Preview</span></div>
            <div className="map-frame hero-map-frame"><IssueMap issues={visibleIssues} selectedId={selectedId} onSelect={setSelectedId} /></div>
            <div className="hero-map-caption"><span><MapPin size={14} aria-hidden="true" /> Illustrative sample pins</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></div>
          </aside>
        </section>

        {reportOpen && (
          <section className="report-panel" aria-labelledby="report-heading">
            <div className="report-panel-head">
              <div>
                <h2 id="report-heading">Add a local issue</h2>
                <p>Your report stays in this browser during this preview.</p>
              </div>
              <button className="icon-button" type="button" aria-label="Close report form" onClick={() => setReportOpen(false)}><X size={19} /></button>
            </div>
            <form className="report-form" id="report-form" onSubmit={submitReport}>
              <div className="field field-wide">
                <label htmlFor="report-title">Issue title <span aria-hidden="true">(required)</span></label>
                <input id="report-title" name="title" minLength={4} maxLength={100} required aria-describedby="title-help" />
                <span className="field-help" id="title-help">Keep it short and describe what needs attention.</span>
              </div>
              <div className="field">
                <label htmlFor="report-category">Category <span aria-hidden="true">(required)</span></label>
                <select id="report-category" name="category" required defaultValue="">
                  <option value="" disabled>Select a category</option>
                  {issueCategories.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="report-severity">Severity <span aria-hidden="true">(required)</span></label>
                <select id="report-severity" name="severity" required defaultValue="">
                  <option value="" disabled>Select severity</option>
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </div>
              <div className="field field-wide">
                <label htmlFor="report-description">What did you see? <span aria-hidden="true">(required)</span></label>
                <textarea id="report-description" name="description" minLength={12} maxLength={1000} required aria-describedby="description-help" />
                <span className="field-help" id="description-help">Stick to observable details. Avoid naming people.</span>
              </div>
              <div className="field">
                <label htmlFor="report-photo">Photo evidence</label>
                <input className="photo-input" id="report-photo" name="photo" type="file" accept="image/*" capture="environment" />
                <span className="field-help">Photo selection is preview-only and is not uploaded.</span>
              </div>
              <div className="field">
                <span className="field-help">Location is optional and attached to this report.</span>
                <button className="btn" type="button" onClick={captureLocation}>
                  {location ? <Check size={16} aria-hidden="true" /> : <LocateFixed size={16} aria-hidden="true" />}
                  {location ? "Location attached" : "Attach my location"}
                </button>
              </div>
              <div className="field field-wide">
                <AreaLookupCard result={areaLookup} loading={areaLookupLoading} error={areaLookupError} disabled={!location} onLookup={lookupReportArea} />
              </div>
              {formError && <p className="field-error field-wide" role="alert">{formError}</p>}
              <div className="form-actions">
                <p className="form-message" aria-live="polite">Reports are not sent to a government office in this starter.</p>
                <button className="btn btn-primary" type="submit" disabled={saving} aria-busy={saving}>
                  {saving ? "Saving report…" : "Save report"}
                </button>
              </div>
            </form>
          </section>
        )}

        <div className="workspace">
          <section className="feed" id="issue-board" aria-labelledby="feed-heading">
            {selectedIssue ? <>
              <button className="back-link" type="button" onClick={() => setSelectedId(null)}><ArrowLeft size={17} /> Back to all issues</button>
              <article className="detail-card">
                <div className="detail-kicker"><span className="tag tag-demo">{selectedIssue.demo ? "Sample report" : "This device"}</span><span className={`tag ${selectedIssue.status === "Community verified" ? "tag-open" : ""}`}>{selectedIssue.status}</span></div>
                <h2 className="detail-title">{selectedIssue.title}</h2>
                <p className="detail-description">{selectedIssue.description}</p>
                {selectedIssue.sampleImage && <figure className="detail-photo"><img src={selectedIssue.sampleImage} alt={`Illustrative image for sample report: ${selectedIssue.title}`} /><figcaption>Illustrative sample image · not evidence from a real report</figcaption></figure>}
                <div className="detail-meta"><span><MapPin size={15} />{selectedIssue.location}</span><span>{selectedIssue.category}</span></div>
                <div className="detail-callout"><strong>What happens next</strong><p>Neighbors can add independent confirmations. A community status needs multiple people; this preview does not contact a civic office.</p></div>
                <div className="detail-actions">
                  <button className="btn btn-primary" type="button" disabled={confirmedIds.includes(selectedIssue.id)} onClick={() => recordConfirmation(selectedIssue)}><ShieldCheck size={17} />{confirmedIds.includes(selectedIssue.id) ? "Saved on this device" : "Save my confirmation"}</button>
                  <button className="btn" type="button" onClick={() => copyEscalation(selectedIssue)}><Copy size={16} />Copy escalation draft</button>
                </div>
                <section className="timeline" aria-labelledby="timeline-heading">
                  <h3 id="timeline-heading">Issue progress</h3>
                  <ol><li className="timeline-current"><span className="timeline-dot"/><div><strong>{selectedIssue.status}</strong><p>Current status shown by this {selectedIssue.demo ? "sample" : "preview"} record.</p></div></li><li><span className="timeline-dot"/><div><strong>Next: gather local evidence</strong><p>Add a photo or independent confirmation when you have firsthand information.</p></div></li></ol>
                </section>
                <section className="accountability-note" aria-labelledby="accountability-heading"><div><h3 id="accountability-heading">No issue-specific work record linked</h3><p>The area lookup below provides official contact and grievance sources; it does not link this report to a known tender, work order, department assignment, or individual worker.</p></div><span className="tag tag-demo">Verify first</span></section>
                <AreaLookupCard result={areaLookup} loading={areaLookupLoading} error={areaLookupError} disabled={!selectedIssue.position} onLookup={lookupSelectedArea} />
              </article>
              <section className="campaign-section" aria-labelledby="campaign-heading">
                <div className="section-heading"><h2 id="campaign-heading">Community campaign</h2><span className="tag tag-demo">Preview pledges</span></div>
                {campaigns.filter((item) => item.issueId === selectedIssue.id).map((campaign) => {
                  const pledged = campaign.contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
                  return <article className="campaign-flow" key={campaign.issueId}>
                    <div className="campaign-overview"><div className="campaign-amount"><span>Pledge interest</span><strong>₹{pledged.toLocaleString("en-IN")}</strong><small>of ₹{campaign.target.toLocaleString("en-IN")} target</small></div><div className="campaign-description"><h3>{campaign.purpose}</h3><p>Proposed executor: {campaign.executor}</p><p>{campaign.plan}</p><small>Deadline {campaign.deadline}</small></div></div>
                    <div className="campaign-progress-line"><div className="progress-track" role="progressbar" aria-label="Pledge intent progress, not money collected" aria-valuenow={Math.min(100, Math.round(pledged / campaign.target * 100))} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, pledged / campaign.target * 100)}%` }} /></div><span>{campaign.contributions.length} supporter{campaign.contributions.length === 1 ? "" : "s"}</span></div>
                    <div className="campaign-ledger"><div className="ledger-heading"><div><h4>People backing this</h4><p>Names and pledge intents are public on this campaign.</p></div><Users size={21}/></div>
                      {campaign.contributions.length ? <ol className="supporter-list">{campaign.contributions.map((contribution) => <li key={contribution.id}><span className="supporter-initial" aria-hidden="true">{contribution.display_name.trim().charAt(0).toUpperCase()}</span><div className="supporter-note"><strong>{contribution.display_name}</strong><p>{contribution.thank_you_note}</p><small>{contribution.kind} · ₹{contribution.amount.toLocaleString("en-IN")} · {new Date(contribution.created_at).toLocaleDateString("en-IN")}</small></div><Heart size={16} aria-label="Thank you"/></li>)}</ol> : <p className="ledger-empty">Be the first neighbor to add a public pledge intent.</p>}
                    </div>
                    <form className="contribution-form" data-endpoint="/api/v1/campaigns/{issue_id}/contributions" data-handoff="Local-only pledge intents are visible only on this device." onSubmit={(event) => addPledge(event, campaign)}>
                      <div className="contribution-heading"><Heart size={18}/><div><h4>Back this effort</h4><p>{campaign.source === "shared" ? "We’ll thank you by name in the public supporter list." : "Your pledge and thanks will stay in this browser until the campaign is published."}</p></div></div>
                      <div className="contribution-fields"><div className="field"><label htmlFor={`supporter-${campaign.issueId}`}>Name to display</label><input id={`supporter-${campaign.issueId}`} name="display_name" required minLength={2} maxLength={60} placeholder="Your name or public handle"/></div><div className="field"><label htmlFor={`pledge-${campaign.issueId}`}>Pledge amount (₹)</label><input id={`pledge-${campaign.issueId}`} name="amount" type="number" min="1" max="10000000" step="1" required placeholder="500"/></div></div>
                      <label className="public-consent"><input type="checkbox" required/><span>{campaign.source === "shared" ? "I agree my display name and pledge amount will be visible to everyone." : "I understand this pledge is only saved in this browser for now."}</span></label>
                      <button className="btn btn-warm" type="submit" disabled={campaignSaving}>{campaignSaving ? "Saving…" : campaign.source === "shared" ? "Pledge and say thanks" : "Save pledge intent"}<ArrowUpRight size={16}/></button>
                      <p className="pledge-disclosure">Pledge intent only—no money has moved. Display names are self-reported; neither identity nor payment is verified.</p>
                    </form>
                    {campaign.source === "local" && <div className="share-prompt"><p>Only people using this browser can see this list.</p>{apiOnline ? <button className="text-action" type="button" disabled={campaignSaving} onClick={() => publishLocalCampaign(campaign)}>Publish campaign <ArrowUpRight size={16}/></button> : <p>Start the shared API to publish it for other users.</p>}</div>}
                  </article>;
                })}
                {!campaigns.some((item) => item.issueId === selectedIssue.id) && (selectedIssue.status === "Community verified" ? <form className="campaign-form" onSubmit={(event) => saveCampaign(event, selectedIssue)}><p className="campaign-intro">Plan the work before inviting neighbors to pledge. This preview does not collect money.</p><div className="field"><label htmlFor="campaign-purpose">Campaign purpose</label><input id="campaign-purpose" name="purpose" required maxLength={120} placeholder="What will this fund?" /></div><div className="campaign-form-row"><div className="field"><label htmlFor="campaign-target">Target (₹)</label><input id="campaign-target" name="target" type="number" min="1" max="100000000" required /></div><div className="field"><label htmlFor="campaign-deadline">Deadline</label><input id="campaign-deadline" name="deadline" type="date" required /></div></div><div className="field"><label htmlFor="campaign-executor">Proposed executor</label><input id="campaign-executor" name="executor" required minLength={2} maxLength={120} placeholder="Person or organization (unverified)" /></div><div className="field"><label htmlFor="campaign-plan">How funds would be used</label><textarea id="campaign-plan" name="plan" required minLength={12} maxLength={1000} placeholder="List the work and how receipts or proof will be shared." /></div><button className="btn btn-warm" type="submit" disabled={campaignSaving}>{campaignSaving ? "Saving…" : apiOnline ? "Publish community campaign" : "Save campaign on this device"}<ArrowUpRight size={16}/></button></form> : <div className="campaign-locked"><ShieldCheck size={20}/><div><strong>Campaigns are available after community verification</strong><p>This issue is currently “{selectedIssue.status}”. The sample verified issue demonstrates campaign setup.</p></div></div>)}
                {campaignMessage && <p className="campaign-message" role="status">{campaignMessage}</p>}
              </section>
            </> : <>
            <h2 className="visually-hidden" id="feed-heading">Issue list</h2>
            <div className="board-intro">
              <div>
                <h2>What neighbors are noticing</h2>
                <p>Local reports, with room for evidence and follow-through.</p>
              </div>
              <span className="board-place"><MapPin size={15} aria-hidden="true" /> Bhubaneswar, Odisha</span>
            </div>
            <div className="toolbar">
              <div className="toolbar-left">
                <label className="search-box">
                  <Search size={17} aria-hidden="true" />
                  <span className="visually-hidden">Search issues</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues" />
                </label>
              </div>
              <div className="toolbar-right">
                <label>
                  <span className="visually-hidden">Filter by category</span>
                  <select className="filter-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option>All categories</option>
                    {issueCategories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span className="visually-hidden">Filter by status</span>
                  <select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option>All statuses</option>
                    <option>Awaiting confirmation</option>
                    <option>Community verified</option>
                    <option>Escalated</option>
                  </select>
                </label>
              </div>
            </div>
            <p className="result-label">{hydrated ? `${visibleIssues.length} preview reports` : "Loading reports"}</p>
            <div className="issue-list" aria-live="polite">
              {visibleIssues.length ? visibleIssues.map((issue) => (
                <article className={`issue-row${issue.id === selectedId ? " issue-row-selected" : ""}${issue.sampleImage ? " has-photo" : ""}`} key={issue.id}>
                  {issue.sampleImage && <img className="issue-thumb" src={issue.sampleImage} alt={`Illustrative image for sample report: ${issue.title}`} loading="lazy" />}
                  <div className="issue-main">
                <h3 className="issue-title">{issue.title}</h3>
                <div className="issue-meta">
                      <span className={`tag ${issue.status === "Community verified" ? "tag-open" : ""}`}>{issue.status}</span>
                      <span>{issue.category}</span>
                      {!issue.demo && <span className="tag tag-demo">This device</span>}
                    </div>
                    <p className="issue-description">{issue.description}</p>
                    <span className="issue-location"><MapPin size={14} aria-hidden="true" />{issue.location}</span>
                  </div>
                  <button className="open-issue" type="button" aria-label={`Open details for ${issue.title}`} onClick={() => setSelectedId(issue.id)}>
                    Details <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                </article>
              )) : (
                <div className="empty-state">
                  <h2>No reports match those filters</h2>
                  <p>Clear a filter or add a report to start the local list.</p>
                </div>
              )}
            </div>
            {localIssues.length > 0 && <button className="btn" type="button" onClick={clearLocalIssues}>Clear local reports</button>}
            </>}
          </section>

        </div>
      </main>
      <footer className="site-footer"><a className="footer-brand" href="#main"><span className="brand-mark"><MapPin aria-hidden="true" strokeWidth={2} /></span><span>CivicPulse</span></a><span className="footer-credit">Built by <strong>Creta</strong></span><span className="footer-note">An independent community preview · Sample reports and photos are illustrative</span></footer>
      <button className="btn btn-primary mobile-report" type="button" onClick={openReport}><Plus size={18} aria-hidden="true" /> Report an issue</button>
      {message && <div className="toast" role="status">{message}</div>}
    </div>
  );
}
