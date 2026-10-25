import assert from 'node:assert/strict';
import test from 'node:test';
import { comparePatientPriority, patientPriority, detailPriority, riskOutOfTen } from '../src/lib/risk.ts';
import type { PatientDetail } from '../src/lib/types.ts';

const jerry = { risk_score: 27.17, latest_news: 5, news_alert: {score: 5, band: 'medium' as const, single_red_parameters: ['heart_rate']} };

test('Jerry stays red with an unresolved acknowledged escalation without inflating his combined score', () => {
  const result = patientPriority({...jerry, open_escalation: {status: 'acknowledged'}});
  assert.equal(result.rank, 3);
  assert.equal(result.label, 'Escalation acknowledged');
  assert.match(result.reason, /NEWS 5 · Medium/);
  assert.equal(riskOutOfTen(jerry.risk_score), 3);
});

test('open, acknowledged, and overdue escalations all remain red', () => {
  for (const status of ['open', 'acknowledged', 'auto_escalated'] as const) {
    assert.equal(patientPriority({risk_score: 0, latest_news: 0, open_escalation: {status}}).rank, 3);
  }
});

test('assessment or resolution removes escalation red while a NEWS warning remains', () => {
  for (const status of ['assessed', 'resolved'] as const) {
    const result = patientPriority({...jerry, open_escalation: {status}});
    assert.equal(result.rank, 2);
    assert.equal(result.label, 'NEWS 5 · Medium');
  }
  assert.equal(patientPriority({risk_score: 20, latest_news: 0, open_escalation: {status: 'resolved'}}).rank, 0);
});

test('NEWS high is red with no worry or escalation and even a zero combined score', () => {
  const result = patientPriority({risk_score: 0, latest_news: 7});
  assert.equal(result.rank, 3);
  assert.equal(result.label, 'NEWS 7 · High');
});

test('a server-reported single red parameter is visible below aggregate NEWS 5', () => {
  const result = patientPriority({risk_score: 10, news_alert: {score: 3, band: 'single_red', single_red_parameters: ['heart_rate']}});
  assert.equal(result.rank, 2);
  assert.equal(result.label, 'NEWS 3 · Single parameter 3');
});

test('NEWS medium never lowers an already high combined score', () => {
  assert.equal(patientPriority({...jerry, risk_score: 85}).rank, 3);
});

test('missing NEWS is explicitly unavailable', () => {
  assert.equal(patientPriority({risk_score: 0}).reason, 'NEWS unavailable');
});

test('detail uses live risk and escalation history instead of a stale patient field', () => {
  const detail = {patient: {risk_score: 99}, risk: {score: 27.17, latest_news: 5}, news_alert: jerry.news_alert, escalations: [{status:'resolved'}, {status:'acknowledged'}]} as PatientDetail;
  assert.equal(detailPriority(detail).label, 'Escalation acknowledged');
});


test('an unresolved escalation outranks a higher combined model score', () => {
  const acknowledged = {...jerry, open_escalation: {status: 'acknowledged' as const}};
  const highModel = {risk_score: 95, latest_news: 0};
  assert(comparePatientPriority(acknowledged, highModel) < 0);
  assert(comparePatientPriority({risk_score: 0, latest_news: 7}, {risk_score: 70, latest_news: 0}) < 0);
});
