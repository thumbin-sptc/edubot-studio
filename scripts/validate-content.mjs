import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCreateContent } from '../src/lib/create/content.ts';
import { indexInventory } from '../src/lib/prompt-catalog.ts';
import { isRecord, parsePromptLinks, parsePromptTemplate, promptIdPattern } from '../src/lib/prompt-template.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const fail = (errors, message) => errors.push(message);
const tokenRegex = /\{\{([a-zA-Z][\w-]*)\}\}/g;
const fieldKinds = new Set(['single-select','multi-select','short-text','long-text','number','repeatable']);

export function validatePrompt(template, inventoryIds = null) {
  const errors = [];
  if (!isRecord(template)) return ['prompt template must be an object'];
  for (const key of ['id','version','title','sourceOriginalText','templateText']) {
    if (typeof template[key] !== 'string' || !template[key].trim()) fail(errors, `${key} must be a non-empty string`);
  }
  if (!['draft','reviewed','published'].includes(template.publicationStatus)) fail(errors, 'invalid publicationStatus');
  if (!/^\d+\.\d+\.\d+$/.test(template.version ?? '')) fail(errors, 'version must be semver-like x.y.z');
  if (!promptIdPattern.test(template.id ?? '')) fail(errors, 'invalid template id');
  if (inventoryIds && template.publicationStatus !== 'published' && !inventoryIds.has(template.id)) fail(errors, 'id not registered in inventory');
  const mode = template.mode ?? 'wizard';
  if (!['wizard','simple-copy'].includes(mode)) fail(errors, 'invalid mode');
  if (!Array.isArray(template.steps) || (mode==='wizard' && !template.steps.length)) fail(errors, 'steps missing');
  if (!Array.isArray(template.fields)) fail(errors, 'fields missing');
  if (errors.length) return errors;
  if (template.publicationStatus === 'published') {
    try {
      parsePromptTemplate(template);
    } catch (error) {
      fail(errors, error.message);
    }
    validateProvisionalOriginal(template, errors);
    return errors;
  }
  try {
    parsePromptLinks(template, template.id, template.fields.filter(isRecord));
  } catch (error) {
    fail(errors, error.message);
  }

  const fieldIds = new Set();
  const tokens = new Set([...template.templateText.matchAll(tokenRegex)].map((m)=>m[1]));
  if (mode==='wizard' && !tokens.size) fail(errors,'wizard template must have at least one declared token');
  if (mode==='simple-copy' && (tokens.size || template.fields.length)) fail(errors,'simple-copy must not declare fields or tokens');
  for (const field of template.fields) {
    if (!field.id || fieldIds.has(field.id)) fail(errors,`invalid/duplicate field id: ${field.id}`);
    fieldIds.add(field.id);
    if (!fieldKinds.has(field.kind)) fail(errors,`invalid field kind: ${field.kind}`);
    if (field.placeholderToken !== `{{${field.id}}}`) fail(errors,`field ${field.id} token mismatch`);
    if (!tokens.has(field.id)) fail(errors,`field ${field.id} token missing from templateText`);
    if (field.kind==='repeatable' && field.exampleItems && !Array.isArray(field.exampleItems)) fail(errors,`field ${field.id} bad exampleItems`);
  }
  for (const token of tokens) if (!fieldIds.has(token)) fail(errors,`undeclared token: ${token}`);
  const stepIds = new Set();
  for (const step of template.steps) {
    if (!step.id || stepIds.has(step.id)) fail(errors,`invalid/duplicate step id: ${step.id}`);
    stepIds.add(step.id);
    for (const fieldId of (step.fieldIds ?? [])) if (!fieldIds.has(fieldId)) fail(errors,`step ${step.id} unknown field ${fieldId}`);
  }
  for (const field of template.fields) {
    if (!template.steps.some((step)=>(step.fieldIds ?? []).includes(field.id))) fail(errors,`field ${field.id} does not appear in steps`);
  }
  if ([...template.sourceOriginalText.matchAll(tokenRegex)].length) fail(errors,'sourceOriginalText contains placeholder; original should be literal');
  validateProvisionalOriginal(template, errors);
  return errors;
}

function validateProvisionalOriginal(template, errors) {
  // Only for two provisional teacher-philosophy prompts: confirm editing replaced the list and nothing else.
  if (['SC-001','SS-001'].includes(template.id)) {
    const beliefs = template.fields.find((f)=>f?.id==='educationalBeliefs')?.exampleItems;
    if (!Array.isArray(beliefs) || !beliefs.length) fail(errors,'missing original list of educationalBeliefs');
    else {
      const reconstructed = template.templateText.replace('{{educationalBeliefs}}',beliefs.map((item)=>`• ${item}`).join('\n'));
      if (reconstructed !== template.sourceOriginalText) fail(errors,'original text reconstruction mismatch; manual review required');
    }
  }
}

export function validateInventory(inventory) {
  const errors=[];
  if (!Array.isArray(inventory.items)) return ['inventory.items must be an array'];
  const ids = new Set();
  for (const item of inventory.items) {
    if (typeof item.id!=='string'||!item.id) fail(errors,'inventory item missing id');
    if (ids.has(item.id)) fail(errors,`duplicate inventory id: ${item.id}`);
    ids.add(item.id);
  }
  for (const item of inventory.items) {
    if (item.suggestedNextIds === undefined) continue;
    if (!Array.isArray(item.suggestedNextIds)) {
      fail(errors, `invalid suggestedNextIds for ${item.id}`);
      continue;
    }
    if (new Set(item.suggestedNextIds).size !== item.suggestedNextIds.length) fail(errors, `duplicate suggestedNextIds for ${item.id}`);
    for (const next of item.suggestedNextIds) {
      if (!ids.has(next)) fail(errors,`unknown related prompt ${next} from ${item.id}`);
      if (next === item.id) fail(errors, `self-referencing suggestedNextIds for ${item.id}`);
    }
  }
  return errors;
}

export function promptLinkWarnings(templates, inventory) {
  const items = indexInventory(inventory);
  const status = new Map(templates.filter(isRecord).map(({ id, publicationStatus }) => [id, publicationStatus]));
  const warnings = [];
  for (const template of templates.filter(isRecord)) {
    const item = items.get(template.id);
    if (item && Array.isArray(item.suggestedNextIds)) {
      const actual = template.relatedPromptIds ?? [];
      if (Array.isArray(actual) && (actual.length !== item.suggestedNextIds.length ||
          actual.some((id) => !item.suggestedNextIds.includes(id)))) {
        warnings.push(`${template.id}: relatedPromptIds와 suggestedNextIds가 다릅니다. 공개 추천에는 템플릿의 relatedPromptIds만 사용합니다.`);
      }
    }
    if (template.publicationStatus !== 'published') continue;
    const related = Array.isArray(template.relatedPromptIds) ? template.relatedPromptIds : [];
    const imports = Array.isArray(template.previousResultImports) ? template.previousResultImports : [];
    const linked = new Set([...related, ...imports.filter(isRecord).flatMap(({ sourcePromptIds }) =>
      Array.isArray(sourcePromptIds) ? sourcePromptIds : [])]);
    for (const id of linked) if (status.get(id) !== 'published') {
      warnings.push(`${template.id}: 공개 승인되지 않은 연결 대상 ${id}는 앱에서 제외합니다.`);
    }
  }
  return warnings;
}

export function validateContent() {
  const inventory = read('content/prompt-inventory.json');
  const errors = validateInventory(inventory);
  const ids=new Set(inventory.items.map((p)=>p.id));
  const promptDir=path.join(root,'content/prompts');
  const paths=fs.readdirSync(promptDir).filter((name)=>name.endsWith('.json'));
  const templates = [];
  for (const filename of paths) {
    const template = read(`content/prompts/${filename}`);
    templates.push(template);
    if (filename !== `${template?.id}.json`) fail(errors,`${filename}: filename does not match id`);
    for (const error of validatePrompt(template,ids)) fail(errors,`${filename}: ${error}`);
  }
  const creation = inspectCreateContent(root);
  errors.push(...creation.errors);
  const warnings = errors.length ? [] : promptLinkWarnings(templates, inventory);
  return {errors, warnings, inventoryCount: inventory.items.length, officialCount: inventory.items.filter((p)=>!p.id.startsWith('DD-X')).length, candidateCount: inventory.items.filter((p)=>p.id.startsWith('DD-X')).length, templateCount: paths.length, publishedPromptCount: templates.filter((template) => template?.publicationStatus === 'published').length, publishedGuideCount: creation.entries.filter((entry) => entry.support === 'supported').length};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {errors,warnings,inventoryCount,officialCount,candidateCount,templateCount,publishedPromptCount,publishedGuideCount}=validateContent();
  if (errors.length) {
    console.error('❌ 콘텐츠 무결성 검사 실패:\n' + errors.map((e)=>' - '+e).join('\n'));
    process.exitCode=1;
  } else {
    for (const warning of warnings) console.warn(`⚠ ${warning}`);
    console.log(`✅ 원고 공식 프롬프트 ${officialCount}건 + 추가 후보 ${candidateCount}건 (메타데이터 총 ${inventoryCount}건), 템플릿 ${templateCount}건 무결성 검사 통과 (공개 ${publishedPromptCount}건)`);
    console.log(`✅ 에듀봇 제작 콘텐츠 검사 통과 (공개 가이드 ${publishedGuideCount}건)`);
  }
}
