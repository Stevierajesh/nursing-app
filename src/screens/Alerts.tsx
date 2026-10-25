import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, ErrorNote, Spinner, timeAgo } from "../components/Primitives";
import EscalationActions from "../components/EscalationActions";
import { api } from "../lib/api";
import { usePatients } from "../lib/patients";
import { patientLocation } from "../lib/patientOrder";
import { comparePatientPriority, patientPriority, riskOutOfTen } from "../lib/risk";
import { CONDITIONS, type MedicationReview } from "../lib/mobileTypes";
import type { Patient } from "../lib/types";

const OPEN_REVIEWS = ["pending", "escalated"];
const needsAction = (patient: Patient) => !patient.open_escalation?.acknowledged_at;
const PILL = "inline-flex min-h-11 items-center justify-center rounded-full border border-accent/40 px-3 py-2 text-center text-xs font-semibold text-accent transition hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent";

interface Activity {
  id: string;
  at: string;
  text: string;
  badge: string;
  tone: "critical" | "pending" | "approved" | "neutral";
  to: string;
}

const BADGE = {
  critical: "bg-very/15 text-very",
  pending: "bg-slight/15 text-slight",
  approved: "bg-calm/15 text-calm",
  neutral: "bg-ink-900 text-ink-400",
};

export default function Alerts() {
  const { patients, loading, error, refresh } = usePatients();
  const [onlyAction, setOnlyAction] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState("");
  const [reviews, setReviews] = useState<MedicationReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const loadReviews = useCallback(async () => {
    try {
      const result = await api.get<{ reviews: MedicationReview[] }>("/api/v1/medication/reviews");
      setReviews(result.reviews);
      setReviewError(null);
    } catch (failure) {
      setReviewError(failure instanceof Error ? failure.message : "Could not load medication updates");
    } finally { setReviewsLoading(false); }
  }, []);
  useEffect(() => {
    void loadReviews();
    const timer = setInterval(() => void loadReviews(), 15000);
    return () => clearInterval(timer);
  }, [loadReviews]);

  if (loading) return <Spinner label="Loading alerts" />;
  const groups = ["auto_escalated", "open", "acknowledged"];
  const alerts = groups.flatMap(status => patients.filter(patient => patient.open_escalation?.status === status).sort(comparePatientPriority));
  const pending = reviews.filter(review => OPEN_REVIEWS.includes(review.status));
  const actionCount = alerts.filter(needsAction).length + pending.filter(review => review.info_requested_at).length;
  const shown = onlyAction ? alerts.filter(needsAction) : alerts;
  const shownReviews = onlyAction ? pending.filter(review => review.info_requested_at) : pending;

  // This rail is built from recorded events, with their actual timestamps.
  // No delivery, re-paging, or notification history is inferred from a score.
  const activity: Activity[] = [];
  for (const patient of alerts) {
    const escalation = patient.open_escalation!;
    const location = patientLocation(patient);
    activity.push({id: `${escalation.id}:raised`, at: escalation.triggered_at, text: `${location} · Escalation raised`, badge: "Alert", tone: "critical", to: `/respond/${patient.id}`});
    if (escalation.acknowledged_at) activity.push({id: `${escalation.id}:ack`, at: escalation.acknowledged_at, text: `${location} · Escalation acknowledged`, badge: "Seen", tone: "neutral", to: `/respond/${patient.id}`});
  }
  for (const review of reviews) {
    const location = review.patient ? patientLocation(review.patient) : "Patient";
    activity.push({id: `${review.id}:sent`, at: review.created_at, text: `${location} · ${CONDITIONS[review.condition]} concern sent for review`, badge: "Sent", tone: "pending", to: "/meds"});
    if (review.escalated_at) activity.push({id: `${review.id}:escalated`, at: review.escalated_at, text: `${location} · Medication request escalated`, badge: "Escalated", tone: "critical", to: "/meds"});
    if (review.info_requested_at) activity.push({id: `${review.id}:question`, at: review.info_requested_at, text: `${location} · Prescriber requested more information`, badge: "Reply needed", tone: "pending", to: "/meds"});
    if (review.reviewed_at && !OPEN_REVIEWS.includes(review.status)) activity.push({id: `${review.id}:decision`, at: review.reviewed_at, text: `${location} · Medication request ${review.status}`, badge: review.status === "approved" ? "Approved" : "Reviewed", tone: review.status === "approved" ? "approved" : "neutral", to: "/meds"});
  }
  const recent = activity.filter(event => Number.isFinite(Date.parse(event.at))).sort((a,b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 10);

  return <div className="space-y-6 p-4 sm:p-6 lg:p-7">
    {error && <ErrorNote>{error}</ErrorNote>}
    {reviewError && <ErrorNote>{reviewError}</ErrorNote>}
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
      <section aria-labelledby="alerts-action-heading" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="alerts-action-heading" className="text-sm font-semibold tracking-wide text-ink-400">Needs your action</h2>
          <div role="group" aria-label="Filter alerts" className="flex rounded-full border border-ink-600 bg-white p-1">
            {[{label: "All", value: false}, {label: `Needs action · ${actionCount}`, value: true}].map(filter => <button key={filter.label} aria-pressed={onlyAction === filter.value} onClick={() => setOnlyAction(filter.value)} className={`min-h-9 rounded-full px-3 text-[11px] font-semibold ${onlyAction === filter.value ? "bg-accent text-white" : "text-ink-400"}`}>{filter.label}</button>)}
          </div>
        </div>
        <div className="space-y-4">
          {shown.map(patient => {
            const escalation = patient.open_escalation!;
            const priority = patientPriority(patient);
            return <article key={escalation.id} aria-label={`Alert for ${patient.display_name}`} className="rounded-3xl border border-very/50 bg-very/[0.07] p-4 lg:p-5">
              <Link to={`/respond/${patient.id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold tracking-tight">{patientLocation(patient)}</h3>
                  <span className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-very/15 px-2.5 py-1 text-[10px] font-bold text-very">{escalation.acknowledged_at ? "Acknowledged" : escalation.status === "auto_escalated" ? "Overdue" : "Critical"}</span><span aria-hidden className="text-xl leading-6 text-ink-400">›</span></span>
                </div>
                <p className={`mt-2 text-sm font-semibold ${priority.band.text}`}>{priority.label}</p>
                <p className="mt-1 text-xs leading-5 text-ink-400">{patient.display_name} · {priority.reason}</p>
                <p className="mt-1 text-xs leading-5 text-ink-400">Raised {timeAgo(escalation.triggered_at)} · Combined score {riskOutOfTen(patient.risk_score)}/10{escalation.acknowledged_at ? " · Assessment pending" : " · Not acknowledged"}</p>
              </Link>
              <EscalationActions patient={patient} compact />
            </article>;
          })}
          {shownReviews.map(review => <article key={review.id} aria-label={`Medication alert for ${review.patient?.display_name ?? "patient"}`} className={`rounded-3xl border p-4 lg:p-5 ${review.status === "escalated" ? "border-very/50 bg-very/[0.07]" : "border-ink-600 bg-white"}`}>
            <Link to={`/worry/${review.patient_id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold tracking-tight">{review.patient ? patientLocation(review.patient) : "Patient"}</h3>
                <span className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${review.status === "escalated" ? BADGE.critical : BADGE.pending}`}>{review.info_requested_at ? "Reply needed" : review.status === "escalated" ? "Escalated" : "Awaiting prescriber"}</span><span aria-hidden className="text-xl leading-6 text-ink-400">›</span></span>
              </div>
              <p className="mt-2 text-sm">{CONDITIONS[review.condition]} medication concern for prescriber review.</p>
              <p className="mt-1 text-xs leading-5 text-ink-400">Sent {timeAgo(review.created_at)}{review.acknowledged_at ? " · Seen by prescriber" : " · Awaiting review"}</p>
              {review.info_requested_at && <p className="mt-2 text-xs font-semibold text-slight">{review.info_request_note || "The prescriber requested more information."}</p>}
            </Link>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" aria-expanded={expandedReviewId === review.id} aria-controls={`review-${review.id}`} onClick={() => setExpandedReviewId(expandedReviewId === review.id ? "" : review.id)} className={`${PILL} border-transparent bg-accent text-white hover:bg-accent/90`}>{expandedReviewId === review.id ? "Close request" : review.info_requested_at ? "View prescriber question" : "View request"}</button>
              <Link to={`/worry/${review.patient_id}`} className={PILL}>Open patient</Link>
            </div>
            {expandedReviewId === review.id && <div id={`review-${review.id}`} className="mt-3 space-y-2 rounded-2xl border border-ink-600 bg-ink-900 p-3 text-sm">
              <p className="text-xs font-semibold text-ink-400">Request details</p>
              <p className="whitespace-pre-wrap">{review.request_note || "No request note recorded."}</p>
              {review.suggested_class && <p>Suggested class: {review.suggested_class.label}</p>}
              {(review.review_note || review.decision_note) && <p className="whitespace-pre-wrap">Prescriber: {review.decision_note || review.review_note}</p>}
            </div>}
          </article>)}
          {reviewsLoading && <p className="py-3 text-xs text-ink-400" role="status">Loading medication updates…</p>}
          {!shown.length && !shownReviews.length && !reviewsLoading && <Card><p className="text-sm text-ink-400">{onlyAction ? "Every open alert has been acknowledged. No medication questions need a reply." : "No open alerts or medication requests."}</p></Card>}
        </div>
      </section>
      <section aria-labelledby="alerts-activity-heading" className="min-w-0">
        <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
          <h2 id="alerts-activity-heading" className="text-sm font-semibold tracking-wide text-ink-400">Recent activity</h2>
          <button onClick={() => void Promise.all([refresh(), loadReviews()])} className="min-h-11 px-2 text-xs font-semibold text-accent">Refresh</button>
        </div>
        <div className="rounded-3xl border border-ink-600 bg-white p-4 lg:p-5">
          {recent.length ? <ul className="divide-y divide-ink-700">{recent.map(event => <li key={event.id}>
            <Link to={event.to} className="flex min-h-20 items-center gap-3 py-3 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
              <time dateTime={event.at} title={new Date(event.at).toLocaleString()} className="w-14 shrink-0 text-[11px] tabular-nums text-ink-400">{new Date(event.at).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})}</time>
              <span className="min-w-0 flex-1 text-xs leading-5">{event.text}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${BADGE[event.tone]}`}>{event.badge}</span>
            </Link>
          </li>)}</ul> : <p className="py-3 text-sm text-ink-400">No recorded activity yet.</p>}
          <p className="mt-3 border-t border-ink-700 pt-3 text-[11px] leading-5 text-ink-400">Recorded escalation and medication updates.</p>
        </div>
      </section>
    </div>
  </div>;
}
