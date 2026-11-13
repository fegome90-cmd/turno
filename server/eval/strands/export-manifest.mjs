// Requirements come from the corpus, never from the report being graded.
// Usage: node export-manifest.mjs [--set holdout|extended|extended-probe]   (default: holdout, 22 cases)
import {NOTE_CORPUS,NOTE_HOLDOUT} from '../note-corpus.mjs';
import {NOTE_EXTENDED} from '../note-extended.mjs';
import {NOTE_PROBE} from '../note-probe.mjs';
import {contentWords} from '../../task-duplicates.mjs';
const SETS={
  holdout:[...NOTE_CORPUS,...NOTE_HOLDOUT],
  extended:[...NOTE_CORPUS,...NOTE_HOLDOUT,...NOTE_EXTENDED],
  'extended-probe':[...NOTE_CORPUS,...NOTE_HOLDOUT,...NOTE_EXTENDED,...NOTE_PROBE],
};
const argv=process.argv.slice(2);
const flag=argv.indexOf('--set');
const set=flag===-1?'holdout':argv[flag+1];
if(!Object.hasOwn(SETS,set)||argv.length!==(flag===-1?0:2)) throw new Error('Usage: node export-manifest.mjs [--set holdout|extended|extended-probe]');
const cases=SETS[set].map(c=>({
  id:c.id,expect:c.expect,titleWords:c.expectTitleIncludes??[],
  titleStems:(c.expectTitleIncludes??[]).flatMap(w=>contentWords(w)),forbiddenWords:c.forbiddenTitleWords??[],
  ...(c.acceptProposed && {acceptProposed:c.acceptProposed,
    referenceTokens:contentWords(c.snapshotTasks?.find(t=>!t.completed)?.title)}),
}));
console.log(JSON.stringify({schema:'turno-evals-contract/v1',set,cases},null,2));
