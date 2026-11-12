// Reuse Turno's tested tokenizer; do not implement Spanish stemming again in Python.
import {readFileSync} from 'node:fs';
import {contentWords} from '../../task-duplicates.mjs';
const file=process.argv[2];
if(!file) throw new Error('Usage: node prepare-report.mjs report.json');
const report=JSON.parse(readFileSync(file,'utf8'));
if(!Array.isArray(report.cases)) throw new Error('Report cases required');
const cases=report.cases.map(r=>({id:r.id,status:r.status,mutated:r.mutated,modelTotal:r.modelTotal,
  proposedTitle:r.proposedTitle??null,titleTokens:contentWords(r.proposedTitle)}));
console.log(JSON.stringify({run:report.run,reps:report.reps,cases},null,2));
