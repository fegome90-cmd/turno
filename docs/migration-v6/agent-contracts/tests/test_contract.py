import copy, hashlib, json, pathlib, sys, tempfile, unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from contract_gate import validate, check_inventory, scope_errors, FINAL_GATES, AUDIT_COMMANDS

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
  self.add_audits()
 def tearDown(self): self.temp.cleanup()
 def errors(self):return validate(self.brief,self.report,self.matrix,self.baseline,self.root,observed_sha=SHA,observed_tree=TREE,dependency_root=self.root)
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
  self.add_audits()
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
 def migration_risks(self, browser=False):
  evidence=dict(gate='chromium' if browser else 'unit',kind='browser' if browser else 'nonvisual')
  return [dict(id='EXTRA-LIFECYCLE-ASYNC',tasks={'2A':[evidence]},final=[evidence])]
 def errors_with_risks(self, risks):
  return validate(self.brief,self.report,self.matrix,self.baseline,self.root,observed_sha=SHA,observed_tree=TREE,risks=risks,dependency_root=self.root)
 def test_required_migration_risk_cannot_be_omitted(self):
  self.assertTrue(any('omitted from brief' in e for e in self.errors_with_risks(self.migration_risks())))
 def test_browser_migration_risk_cannot_use_unit_evidence(self):
  self.brief['additionalRequirements']=['EXTRA-LIFECYCLE-ASYNC'];self.report['gates'][0]['testCases'].append('EXTRA-LIFECYCLE-ASYNC')
  self.assertTrue(any('wrong class' in e for e in self.errors_with_risks(self.migration_risks(browser=True))))
 def test_final_cannot_omit_migration_risks(self):
  self.complete_final()
  self.assertTrue(any('omitted from brief' in e for e in self.errors_with_risks(self.migration_risks())))
 def test_migration_risk_positive_with_matching_gate(self):
  self.brief['additionalRequirements']=['EXTRA-LIFECYCLE-ASYNC'];self.report['gates'][0]['testCases'].append('EXTRA-LIFECYCLE-ASYNC')
  self.assertEqual(self.errors_with_risks(self.migration_risks()),[])
 def add_audits(self):
  self.brief['gates']=[g for g in self.brief['gates'] if g['id'] not in AUDIT_COMMANDS]
  self.report['gates']=[g for g in self.report['gates'] if g['id'] not in AUDIT_COMMANDS]
  product=self.root/'prototypes/frontend-v6';product.mkdir(parents=True,exist_ok=True)
  for filename in ('package.json','package-lock.json'):(product/filename).write_text('{}')
  digest=hashlib.sha256(b'{}').hexdigest()
  for gid,command in AUDIT_COMMANDS.items():
   self.brief['gates'].append(dict(id=gid,kind='nonvisual',required=True,command=command))
   gate=dict(id=gid,kind='nonvisual',command=command,status='PASS',sha=SHA,treeDigest=TREE,exitCode=0,artifact=f'evidence/{gid}.audit.json',testCases=[],context=dict(cwd='prototypes/frontend-v6',nodeVersion='v24.0.0',npmVersion='11.0.0',registry='https://registry.npmjs.org/',observedAt='2026-11-08T12:00:00Z',packageSha256=digest,lockSha256=digest),risks=[])
   self.report['gates'].append(gate)
   self.write_audit(gate,dict(auditReportVersion=2,vulnerabilities={},metadata=dict(vulnerabilities=dict(info=0,low=0,moderate=0,high=0,critical=0,total=0))))
 def write_audit(self,gate,payload):
  path=self.root/gate['artifact'];path.write_text(json.dumps(payload));gate['artifactSha256']=hashlib.sha256(path.read_bytes()).hexdigest()
 def test_audits_clean(self):self.add_audits();self.assertEqual(self.errors(),[])
 def test_audits_required_in_shell_without_lock(self):
  self.brief['taskId']=self.report['taskId']='1A';(self.root/'prototypes/frontend-v6/package-lock.json').unlink();self.assertTrue(any('audit' in e for e in self.errors()))
 def test_audits_cannot_be_omitted_after_install(self):
  self.add_audits();self.brief['gates']=self.brief['gates'][:1];self.report['gates']=self.report['gates'][:1];self.assertTrue(any('audit' in e for e in self.errors()))
 def test_deleted_lock_cannot_disable_intermediate_audits(self):
  (self.root/'prototypes/frontend-v6/package-lock.json').unlink()
  self.brief['gates']=self.brief['gates'][:1];self.report['gates']=self.report['gates'][:1]
  self.assertTrue(any('Required dependency audit omitted' in e for e in self.errors()))
 def test_audit_required_and_kind_not_downgradable(self):
  self.add_audits()
  for key,value in [('required',False),('kind','visual')]:
   with self.subTest(key=key):
    old=self.brief['gates'][-1][key];self.brief['gates'][-1][key]=value;self.assertTrue(self.errors());self.brief['gates'][-1][key]=old
 def test_audit_command_cannot_hide_dev_or_failure(self):
  self.add_audits();self.brief['gates'][-2]['command']=self.report['gates'][-2]['command']='npm audit --omit=dev --json || true';self.assertTrue(self.errors())
 def test_audits_cannot_reuse_one_artifact(self):
  self.add_audits();self.report['gates'][-1]['artifact']=self.report['gates'][-2]['artifact'];self.assertTrue(self.errors())
 def test_audit_invalid_json_cannot_pass(self):
  self.add_audits();gate=self.report['gates'][-1];path=self.root/gate['artifact'];path.write_text('');gate['artifactSha256']=hashlib.sha256(b'').hexdigest();self.assertTrue(self.errors())
 def test_audit_context_freshness_and_fields(self):
  self.add_audits();gate=self.report['gates'][-1]
  for key in gate['context']:
   with self.subTest(key=key):
    old=gate['context'][key];gate['context'][key]='';self.assertTrue(self.errors());gate['context'][key]=old
  (self.root/'prototypes/frontend-v6/package-lock.json').write_text('{"changed":true}');self.assertTrue(self.errors())
 def test_audit_infrastructure_and_empty_output_cannot_pass(self):
  self.add_audits();gate=self.report['gates'][-1]
  for payload in [{},{'error':{'code':'ENOAUDIT'}},[],{'auditReportVersion':2,'vulnerabilities':{},'metadata':{'vulnerabilities':{'total':0}}}]:
   with self.subTest(payload=payload):self.write_audit(gate,payload);self.assertTrue(self.errors())
 def vulnerable_audit(self):
  self.add_audits();gate=self.report['gates'][-2]
  payload=dict(auditReportVersion=2,vulnerabilities={'example':dict(name='example',severity='moderate',via=['transitive-example'],nodes=['node_modules/example'])},metadata=dict(vulnerabilities=dict(info=0,low=0,moderate=1,high=0,critical=0,total=1)))
  self.write_audit(gate,payload);gate.update(status='FAIL',exitCode=1,risks=[dict(package='example',disposition='unresolved',justification='Test fixture vulnerability',owner='author')]);return gate,payload
 def test_audit_findings_cannot_pass_even_with_runtime_clean(self):
  gate,_=self.vulnerable_audit();self.assertTrue(self.errors());gate.update(status='PASS',exitCode=0);self.assertTrue(self.errors())
 def test_audit_fail_is_valid_stop_and_risks_required(self):
  gate,_=self.vulnerable_audit();self.report.update(decision='STOP',blocker='Resolve example finding');self.assertEqual(self.errors(),[]);gate['risks']=[];self.assertTrue(self.errors())
 def test_accepted_audit_risk_never_lifts_stop(self):
  gate,_=self.vulnerable_audit();gate['risks'][0].update(disposition='accepted',acceptanceEvidence='user-message:fixture');self.assertTrue(self.errors());self.report.update(decision='STOP',blocker='Accepted finding is still FAIL');self.assertEqual(self.errors(),[]);gate['risks'][0].pop('acceptanceEvidence');self.assertTrue(self.errors())
 def test_audit_metadata_cannot_hide_vulnerabilities(self):
  gate,payload=self.vulnerable_audit();payload['metadata']['vulnerabilities'].update(total=0,moderate=0);self.write_audit(gate,payload);gate.update(status='PASS',exitCode=0,risks=[]);self.assertTrue(self.errors())
 def test_audit_blocked_requires_reason_and_stop(self):
  self.add_audits();gate=self.report['gates'][-1];gate.update(status='BLOCKED',exitCode=None,reason='Registry unavailable');self.assertTrue(self.errors());self.report.update(decision='STOP',blocker='Retry permitted registry');self.assertEqual(self.errors(),[]);gate.pop('reason');self.assertTrue(self.errors())
 def test_unknown_task_cannot_bypass_canonical_future_closure(self):
  docs=pathlib.Path(__file__).resolve().parents[2]
  self.baseline=json.loads((docs/'parity-map.json').read_text());self.matrix=copy.deepcopy(self.baseline)
  self.matrix[0]['status']='verified'
  self.brief.update(taskId='typo-1B',requirements=[],additionalRequirements=['EXTRA-TEST'])
  self.report.update(taskId='typo-1B');self.report['gates'][0]['testCases']=['EXTRA-TEST']
  self.assertTrue(any('Unknown taskId' in e for e in self.errors()))
 def final_regression_target(self):
  self.complete_final()
  self.baseline[0]['finalTargetTests']=['tests/e2e/accessibility.spec.ts']
  self.matrix[0]['finalTargetTests']=['tests/e2e/accessibility.spec.ts']
 def test_final_regression_target_cannot_be_missing(self):
  self.final_regression_target()
  self.assertTrue(any('Target test absent' in e for e in self.errors()))
 def test_final_regression_target_positive(self):
  self.final_regression_target();(self.root/'tests/e2e').mkdir();(self.root/'tests/e2e/accessibility.spec.ts').write_text('R-0')
  self.assertEqual(self.errors(),[])
 def test_final_regression_metadata_cannot_be_removed(self):
  self.final_regression_target();self.matrix[0].pop('finalTargetTests')
  self.assertTrue(any('canonical closure' in e for e in self.errors()))
 def closure_contract(self):
  fields=dict(task='4A',preparationTask='1A',integrationTasks=['1A','2A','3A','4A'],closureEvidenceKinds=['browser'])
  self.baseline[0].update(fields);self.matrix[0].update(copy.deepcopy(fields))
  self.brief['taskId']='4A';self.report['taskId']='4A'
  self.brief['gates'][0].update(id='chromium',kind='browser')
  self.report['gates'][0].update(id='chromium',kind='browser',scope='product-integration',integrationTasks=fields['integrationTasks'][:])
  self.matrix[0]['evidence']=['chromium']
 def test_integrated_closure_positive(self):
  self.closure_contract();self.assertEqual(self.errors(),[])
 def test_early_phase_cannot_close_later_identity(self):
  self.closure_contract();self.brief['taskId']='3A';self.report['taskId']='3A'
  self.assertTrue(any('cannot close before' in e for e in self.errors()))
 def test_closure_contract_cannot_be_advanced_or_erased(self):
  self.closure_contract()
  for key in ['task','preparationTask','integrationTasks','closureEvidenceKinds']:
   with self.subTest(field=key):
    old=self.matrix[0].pop(key);self.assertTrue(any('canonical closure' in e for e in self.errors()));self.matrix[0][key]=old
 def test_browser_closure_cannot_use_unit(self):
  self.closure_contract();self.brief['gates'][0]['kind']='nonvisual';self.report['gates'][0]['kind']='nonvisual'
  self.assertTrue(any('product integration evidence' in e for e in self.errors()))
 def test_browser_harness_cannot_close_product(self):
  self.closure_contract();self.report['gates'][0]['scope']='harness'
  self.assertTrue(any('product integration evidence' in e for e in self.errors()))
 def test_missing_integrated_dependency_cannot_close(self):
  self.closure_contract();self.report['gates'][0]['integrationTasks'].remove('3A')
  self.assertTrue(any('product integration evidence' in e for e in self.errors()))
 def test_integration_case_must_be_in_browser_gate(self):
  self.closure_contract();self.report['gates'][0]['testCases']=[]
  self.assertTrue(any('product integration evidence' in e for e in self.errors()))
 def test_unassigned_future_row_cannot_be_marked_verified(self):
  self.baseline[1].update(task='4A',integrationTasks=['4A'],closureEvidenceKinds=['browser'],preparationTask='1A')
  self.matrix[1].update({k:self.baseline[1][k] for k in ['task','integrationTasks','closureEvidenceKinds','preparationTask']})
  self.assertTrue(any('Future requirement marked closed' in e for e in self.errors()))

class DocumentationAssignmentTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  import importlib.util
  cls.docs=pathlib.Path(__file__).resolve().parents[2]
  spec=importlib.util.spec_from_file_location('migration_check_docs',cls.docs/'scripts/check_docs.py')
  cls.checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.checker)
 def setUp(self):
  self.matrix=json.loads((self.docs/'parity-map.json').read_text())
  self.plan=(self.docs/'PLAN.md').read_text()
  self.brief=json.loads((self.docs/'agent-contracts/examples/brief-1A.json').read_text())
 def errors(self):return self.checker.check_assignments(self.matrix,self.plan,self.brief)
 def test_current_plan_matrix_brief_match(self):self.assertEqual(self.errors(),[])
 def test_annex_task_drift_rejected(self):
  self.plan=self.plan.replace('DESIGN-AUDIT-01 · tarea 4B','DESIGN-AUDIT-01 · tarea 1A')
  self.assertTrue(any('annex differs' in e for e in self.errors()))
 def test_annex_target_drift_rejected(self):
  start=self.plan.index('# Anexo B');self.plan=self.plan[:start]+self.plan[start:].replace('tests/component/domain-dialogs.test.tsx','tests/component/other.test.tsx',1)
  self.assertTrue(any('annex differs' in e for e in self.errors()))
 def test_brief_future_identity_rejected(self):
  self.brief['requirements'].append('UI-25');self.assertTrue(any('exactly match' in e for e in self.errors()))
 def test_missing_deferred_obligation_rejected(self):
  self.brief['deferredRequirements'].pop();self.assertTrue(any('deferred integration' in e for e in self.errors()))
 def test_target_created_after_closure_rejected(self):
  next(r for r in self.matrix if r['task']=='1A')['targetTests'].append('tests/e2e/notifications.spec.ts');self.assertTrue(any('not available at closure' in e for e in self.errors()))
 def test_invalid_final_regression_path_rejected(self):
  self.matrix[0]['finalTargetTests']=['../outside.test.ts'];self.assertTrue(any('Invalid final regression' in e for e in self.errors()))
 def test_missing_integration_metadata_rejected(self):
  self.matrix[0]['integrationTasks']=[];self.assertTrue(any('integration dependencies' in e for e in self.errors()))
if __name__=='__main__': unittest.main(verbosity=2)
