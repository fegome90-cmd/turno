import copy, hashlib, json, pathlib, sys, tempfile, unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from contract_gate import validate, check_inventory, scope_errors, FINAL_GATES

SHA='a'*40
TREE='c'*64
class ContractTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(); self.root=pathlib.Path(self.temp.name)
  (self.root/'evidence').mkdir(); (self.root/'evidence/run.log').write_text('1 passed\n')
  self.digest=hashlib.sha256((self.root/'evidence/run.log').read_bytes()).hexdigest()
  self.baseline=[dict(requirementId=f'R-{i}',sourceSha=SHA,sourceFile='v5/test.mjs',sourceTest=f'test {i}') for i in range(212)]
  self.matrix=[dict(x,targetTests=['tests/case.test.ts'],targetCases=[x['requirementId']],status='verified',rationale='',evidence=['unit']) for x in self.baseline]
  (self.root/'tests').mkdir(); (self.root/'tests/case.test.ts').write_text('\n'.join(x['requirementId'] for x in self.baseline))
  self.brief=dict(taskId='2A',mode='execute',baseSha=SHA,headSha=SHA,executionAuthorized=True,acceptanceEvidence='user-message:example',allowedPaths=['prototypes/frontend-v6/**'],requirements=['R-0'],gates=[dict(id='unit',kind='nonvisual',command='npm run test:unit',required=True)],requiredReviews=[])
  self.report=dict(implementer='author',taskId='2A',headSha=SHA,decision='READY_FOR_REVIEW',stage='phase',treeDigest=TREE,gates=[dict(id='unit',kind='nonvisual',command='npm run test:unit',status='PASS',sha=SHA,treeDigest=TREE,exitCode=0,artifact='evidence/run.log',artifactSha256=self.digest,testCases=['R-0'])],reviews=[],changedFiles=['prototypes/frontend-v6/src/a.ts'],tdd=dict(redReason='behavior',redArtifact='evidence/run.log',greenArtifact='evidence/run.log'))
 def tearDown(self): self.temp.cleanup()
 def errors(self):return validate(self.brief,self.report,self.matrix,self.baseline,self.root,observed_sha=SHA,observed_tree=TREE)
 def add_reviews(self):
  self.brief['requiredReviews']=['spec','quality'];self.report['implementer']='author'
  self.report['reviews']=[dict(role=r,reviewer='reviewer',status='PASS',sha=SHA,treeDigest=TREE,artifact='evidence/run.log',artifactSha256=self.digest) for r in ['spec','quality']]
 def test_final_decision_cannot_use_phase_scope(self):
  self.add_reviews();self.report['decision']='APPROVE_FINAL';self.assertTrue(self.errors())
 def test_stale_review_tree(self):
  self.add_reviews();self.report['reviews'][0]['treeDigest']='d'*64;self.assertTrue(self.errors())
 def test_final_needs_browser_visual_and_manual_gates(self):
  self.add_reviews();self.report['decision']='APPROVE_FINAL';self.report['stage']='final';self.report['gates'][0]['testCases']=[r['requirementId'] for r in self.baseline];self.assertTrue(self.errors())
 def test_missing_implementer_identity(self):self.add_reviews();self.report.pop('implementer');self.assertTrue(self.errors())
 def complete_final(self):
  self.add_reviews();self.report['decision']='APPROVE_FINAL';self.report['stage']='final'
  unit=copy.deepcopy(self.report['gates'][0]);unit['testCases']=[r['requirementId'] for r in self.baseline]
  self.brief['gates']=[];self.report['gates']=[]
  for name,kind in FINAL_GATES.items():
   command='record '+name;self.brief['gates'].append(dict(id=name,kind=kind,required=True,command=command))
   gate=dict(unit,id=name,kind=kind,command=command,observer='independent reviewer',observedAt='2026-11-08T12:00:00Z',environment='synthetic fixture only',method='fixture');self.report['gates'].append(gate)
 def test_complete_final_positive(self):self.complete_final();self.assertEqual(self.errors(),[])
 def test_every_final_gate_blocks(self):
  self.complete_final()
  for gate in self.report['gates']:
   with self.subTest(gate=gate['id']):
    gate['status']='NOT RUN';self.assertTrue(self.errors());gate['status']='PASS'
 def test_valid_phase(self):self.assertEqual(self.errors(),[])
 def test_phase_approval_requires_both_reviews(self):self.report['decision']='APPROVE_PHASE';self.assertTrue(self.errors())
 def test_additional_requirement_is_not_free_pass(self):self.brief['additionalRequirements']=['EXTRA-STRICTMODE'];self.assertTrue(self.errors())
 def test_missing_row(self):self.matrix.pop();self.assertTrue(self.errors())
 def test_duplicate_id(self):self.matrix[-1]=self.matrix[0];self.assertTrue(self.errors())
 def test_changed_source_identity(self):self.matrix[0]['sourceTest']='new';self.assertTrue(self.errors())
 def test_changed_tree(self):self.report['treeDigest']='d'*64;self.assertTrue(self.errors())
 def test_stale_tree_evidence(self):self.report['gates'][0]['treeDigest']='d'*64;self.assertTrue(self.errors())
 def test_wrong_head(self):self.report['headSha']='b'*40;self.assertTrue(self.errors())
 def test_missing_observed_sha(self):self.assertTrue(validate(self.brief,self.report,self.matrix,self.baseline,self.root))
 def test_stale_evidence(self):self.report['gates'][0]['sha']='b'*40;self.assertTrue(self.errors())
 def test_missing_evidence_file(self):self.report['gates'][0]['artifact']='evidence/missing';self.assertTrue(self.errors())
 def test_hash_mismatch(self):self.report['gates'][0]['artifactSha256']='0'*64;self.assertTrue(self.errors())
 def test_artifact_escape(self):self.report['gates'][0]['artifact']='../run.log';self.assertTrue(self.errors())
 def test_missing_gate(self):self.report['gates']=[];self.assertTrue(self.errors())
 def test_duplicate_gate(self):self.report['gates']*=2;self.assertTrue(self.errors())
 def test_fail_means_stop(self):self.report['gates'][0]['status']='FAIL';self.report['gates'][0]['exitCode']=1;self.assertTrue(self.errors())
 def test_blocked_means_stop(self):self.report['gates'][0]['status']='BLOCKED';self.assertTrue(self.errors())
 def test_not_run_means_stop(self):self.report['gates'][0]['status']='NOT RUN';self.assertTrue(self.errors())
 def test_kind_mismatch(self):self.report['gates'][0]['kind']='visual';self.assertTrue(self.errors())
 def test_no_backend_scope(self):self.report['changedFiles']=['backend/a.ts'];self.assertTrue(self.errors())
 def test_no_v5_scope(self):self.report['changedFiles']=['prototypes/frontend-v5/index.html'];self.assertTrue(self.errors())
 def test_path_traversal(self):self.report['changedFiles']=['prototypes/frontend-v6/../../backend/a.ts'];self.assertTrue(self.errors())
 def test_no_execute_without_authority(self):self.brief['executionAuthorized']=False;self.assertTrue(self.errors())
 def test_setup_error_not_red(self):self.report['tdd']['redReason']='missing-dependency';self.assertTrue(self.errors())
 def test_missing_test_target(self):self.matrix[0]['targetTests']=['missing.ts'];self.assertTrue(self.errors())
 def test_testcase_must_be_executed(self):self.report['gates'][0]['testCases']=[];self.assertTrue(self.errors())
 def test_planned_cannot_close(self):self.matrix[0]['status']='planned';self.assertTrue(self.errors())
 def test_final_closes_all_rows(self):self.report['stage']='final';self.report['decision']='APPROVE_FINAL';self.assertTrue(self.errors())
 def test_review_required(self):self.brief['requiredReviews']=['spec','quality'];self.assertTrue(self.errors())
 def test_no_self_review(self):
  self.brief['requiredReviews']=['spec'];self.report['implementer']='same';self.report['reviews']=[dict(role='spec',reviewer='same',status='PASS',sha=SHA,artifact='evidence/run.log',artifactSha256=self.digest)];self.assertTrue(self.errors())
 def test_guard_detects_deleted_v5(self):self.assertTrue(scope_errors(['prototypes/frontend-v5/a.ts'],self.brief['allowedPaths']))
 def test_stop_can_report_failure_without_claim(self):
  self.report['decision']='STOP';self.report['gates'][0]['status']='BLOCKED';self.report['gates'][0]['exitCode']=None;self.report['blocker']='Runner unavailable';self.report['tdd']={};self.matrix[0]['status']='planned';self.assertEqual(self.errors(),[])
 def test_prepare_cannot_claim_ready(self):self.brief['mode']='prepare';self.assertTrue(self.errors())
if __name__=='__main__': unittest.main(verbosity=2)
