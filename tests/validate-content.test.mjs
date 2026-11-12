import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent, validatePrompt } from '../scripts/validate-content.mjs';
import fs from 'node:fs';

const example = JSON.parse(fs.readFileSync(new URL('../content/prompts/SC-001.json', import.meta.url), 'utf8'));

test('inventory and draft prompt templates pass validations', () => {
  const result=validateContent();
  assert.deepEqual(result.errors,[]);
  assert.equal(result.inventoryCount,43);
  assert.equal(result.officialCount,34);
  assert.equal(result.candidateCount,9);
  assert.equal(result.templateCount,2);
});

test('all sample templates remain unpublished', () => {
  const result=JSON.parse(fs.readFileSync(new URL('../content/prompts/SS-001.json', import.meta.url),'utf8'));
  assert.equal(example.publicationStatus,'draft');
  assert.equal(result.publicationStatus,'draft');
});

test('undeclared placeholder triggers validation failure', () => {
  const changed=structuredClone(example);
  changed.templateText += '\n{{missing}}';
  assert.ok(validatePrompt(changed).some((error)=>error.includes('undeclared token')));
});

test('unapproved edits to original prompt fail reconstruction check', () => {
  const changed=structuredClone(example);
  changed.sourceOriginalText += '\n임의 추가된 문장';
  assert.ok(validatePrompt(changed).some((error)=>error.includes('reconstruction mismatch')));
});

test('simple-copy templates can be added later without wizard fields', () => {
  const changed=structuredClone(example);
  changed.id='DD-X01';
  changed.mode='simple-copy';
  changed.steps=[];
  changed.fields=[];
  changed.templateText='교재에서 승인한 짧은 한 문장';
  changed.sourceOriginalText='교재에서 승인한 짧은 한 문장';
  assert.deepEqual(validatePrompt(changed), []);
});
