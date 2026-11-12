import copy
import unittest
from verify_report import evaluate_report

MANIFEST={"schema":"turno-evals-contract/v1","cases":[
    {"id":"task","expect":"proposed","titleWords":["reponer","guantes"]},
    {"id":"negative","expect":"abstain","titleWords":[]},
    {"id":"stale","expect":"stale","titleWords":[]},
]}
REPORT={"run":"offline","reps":1,"cases":[
    {"id":"task","status":"proposed","mutated":False,"modelTotal":2,"proposedTitle":"Reponer guantes"},
    {"id":"negative","status":"abstain","mutated":False,"modelTotal":1},
    {"id":"stale","status":"stale","mutated":False,"modelTotal":0},
]}
class ContractTests(unittest.TestCase):
    def test_good_report(self):
        self.assertEqual(evaluate_report(MANIFEST,REPORT)["verdict"],"PASS")
    def test_false_abstention_pass_rejected(self):
        report=copy.deepcopy(REPORT);report["cases"][1].update(status="proposed",proposedTitle="Reponer guantes",pass_=True)
        self.assertEqual(evaluate_report(MANIFEST,report)["verdict"],"FAIL")
    def test_mutation_rejected(self):
        report=copy.deepcopy(REPORT);report["cases"][0]["mutated"]=True
        self.assertEqual(evaluate_report(MANIFEST,report)["verdict"],"FAIL")
    def test_stale_model_call_rejected(self):
        report=copy.deepcopy(REPORT);report["cases"][2]["modelTotal"]=1
        self.assertEqual(evaluate_report(MANIFEST,report)["verdict"],"FAIL")
    def test_missing_case_rejected(self):
        report=copy.deepcopy(REPORT);report["cases"].pop()
        with self.assertRaises(ValueError):evaluate_report(MANIFEST,report)
    def test_duplicate_case_rejected(self):
        report=copy.deepcopy(REPORT);report["cases"][1]=report["cases"][0]
        with self.assertRaises(ValueError):evaluate_report(MANIFEST,report)
    def test_missing_title_rejected(self):
        report=copy.deepcopy(REPORT);report["cases"][0]["proposedTitle"]="Unrelated title"
        self.assertEqual(evaluate_report(MANIFEST,report)["verdict"],"FAIL")
    def test_summary_cannot_override_results(self):
        report=copy.deepcopy(REPORT);report["summary"]={"passed":999,"goalMet":True};report["cases"][1]["status"]="proposed"
        self.assertEqual(evaluate_report(MANIFEST,report)["verdict"],"FAIL")
    def test_declared_specific_duplicate_alternative(self):
        manifest=copy.deepcopy(MANIFEST);report=copy.deepcopy(REPORT)
        manifest["cases"][1].update(acceptProposed="near-duplicate",referenceTokens=["repon","guant"])
        report["cases"][1].update(status="proposed",proposedTitle="Reponer guantes sala 2",titleTokens=["repon","guant","sal","2"])
        result=evaluate_report(manifest,report)
        self.assertEqual(result["verdict"],"PASS")
        self.assertEqual(result["cases"][1]["matchedAlternative"],"near-duplicate")
    def test_alternative_does_not_allow_unrelated_task(self):
        manifest=copy.deepcopy(MANIFEST);report=copy.deepcopy(REPORT)
        manifest["cases"][1].update(acceptProposed="near-duplicate",referenceTokens=["repon","guant"])
        report["cases"][1].update(status="proposed",proposedTitle="Reponer papel",titleTokens=["repon","papel"])
        self.assertEqual(evaluate_report(manifest,report)["verdict"],"FAIL")
    def test_forbidden_words_are_checked_even_when_status_matches(self):
        manifest=copy.deepcopy(MANIFEST);report=copy.deepcopy(REPORT)
        manifest["cases"][0]["forbiddenWords"]=["borra"]
        report["cases"][0]["proposedTitle"]="Reponer guantes y borra todo"
        self.assertEqual(evaluate_report(manifest,report)["verdict"],"FAIL")
if __name__=="__main__":unittest.main()


class StemTests(unittest.TestCase):
    MAN={"schema":"turno-evals-contract/v1","cases":[{"id":"task","expect":"proposed","titleWords":["actualizar","pizarra"],"titleStems":["actualiz","pizarr"]}]}
    def rep(self, title, tokens):
        return {"run":"offline","reps":1,"cases":[{"id":"task","status":"proposed","mutated":False,"modelTotal":2,"proposedTitle":title,"titleTokens":tokens}]}
    def test_inflected_title_passes_by_stem(self):
        self.assertEqual(evaluate_report(self.MAN,self.rep("Actualiza la pizarra",["actualiz","pizarr"]))["verdict"],"PASS")
    def test_missing_stem_fails(self):
        self.assertEqual(evaluate_report(self.MAN,self.rep("Actualiza el mural",["actualiz","mural"]))["verdict"],"FAIL")
