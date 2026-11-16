import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent, validatePrompt } from '../scripts/validate-content.mjs';
import { parsePublishedPrompt } from '../src/lib/prompt-publication.ts';
import { syntheticSimple, syntheticWizard, withSyntheticPublication, wizardReplacements } from './fixtures/synthetic-prompts.mjs';

test('inventory and registered prompt templates pass validations', () => {
  const result=validateContent();
  assert.deepEqual(result.errors,[]);
  assert.equal(result.inventoryCount,43);
  assert.equal(result.officialCount,34);
  assert.equal(result.candidateCount,9);
});

test('synthetic draft templates remain outside the published catalog', () => {
  for (const sample of [syntheticSimple, syntheticWizard]) {
    assert.equal(sample.publicationStatus, 'draft');
    assert.equal(parsePublishedPrompt(sample, sample.id), null);
  }
});

test('undeclared placeholder triggers validation failure', () => {
  const changed = withSyntheticPublication(syntheticWizard, wizardReplacements);
  changed.templateText += '\n{{missing}}';
  assert.match(validatePrompt(changed).join('\n'), /undeclared template placeholder/i);
});

test('unapproved edits to original prompt fail reconstruction check', () => {
  const changed = withSyntheticPublication({
    ...syntheticWizard,
    sourceOriginalText: syntheticWizard.sourceOriginalText + '\n임의 추가된 문장',
  }, wizardReplacements);
  assert.match(validatePrompt(changed).join('\n'), /reconstruction mismatch/i);
});

test('simple-copy templates can be added later without wizard fields', () => {
  assert.deepEqual(validatePrompt(syntheticSimple), []);
});
