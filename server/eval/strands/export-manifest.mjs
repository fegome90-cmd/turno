// Requirements come from the corpus, never from the report being graded.
import {NOTE_CORPUS,NOTE_HOLDOUT} from '../note-corpus.mjs';
import {contentWords} from '../../task-duplicates.mjs';
const cases=[...NOTE_CORPUS,...NOTE_HOLDOUT].map(c=>({
  id:c.id,expect:c.expect,titleWords:c.expectTitleIncludes??[],forbiddenWords:c.forbiddenTitleWords??[],
  ...(c.acceptProposed && {acceptProposed:c.acceptProposed,
    referenceTokens:contentWords(c.snapshotTasks?.find(t=>!t.completed)?.title)}),
}));
console.log(JSON.stringify({schema:'turno-evals-contract/v1',cases},null,2));
