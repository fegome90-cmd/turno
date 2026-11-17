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


class RepetitionTests(unittest.TestCase):
    """pass^k over k repetitions per case; reps=1 keeps the old contract."""
    MAN = copy.deepcopy(MANIFEST)
    def rows(self, reps, change=None):
        rows = []
        for rep in range(1, reps + 1):
            for row in copy.deepcopy(REPORT["cases"]):
                row["rep"] = rep
                rows.append(row)
        if change:
            change(rows)
        return rows
    def report(self, reps=3, change=None):
        return {"run": "live", "reps": reps, "cases": self.rows(reps, change)}
    def test_three_reps_all_pass_is_PASS(self):
        result = evaluate_report(self.MAN, self.report())
        self.assertEqual(result["verdict"], "PASS")
        self.assertEqual((result["passed"], result["total"]), (3, 3))
        self.assertEqual((result["runsPassed"], result["runsTotal"]), (9, 9))
        self.assertEqual(result["flaky"], [])
    def test_one_failing_rep_fails_case_and_is_flaky(self):
        def change(rows):
            task = [r for r in rows if r["id"] == "task" and r["rep"] == 2][0]
            task["proposedTitle"] = "Unrelated title"
        result = evaluate_report(self.MAN, self.report(change=change))
        by_id = {c["id"]: c for c in result["cases"]}
        self.assertFalse(by_id["task"]["pass"])
        self.assertTrue(by_id["task"]["passAny"])
        self.assertTrue(by_id["negative"]["pass"])
        self.assertEqual(result["flaky"], ["task"])
        self.assertEqual((result["passed"], result["total"]), (2, 3))
        self.assertEqual((result["runsPassed"], result["runsTotal"]), (8, 9))
        self.assertEqual(result["verdict"], "FAIL")
    def test_always_failing_case_is_not_flaky(self):
        def change(rows):
            for r in rows:
                if r["id"] == "stale":
                    r["modelTotal"] = 1
        result = evaluate_report(self.MAN, self.report(change=change))
        by_id = {c["id"]: c for c in result["cases"]}
        self.assertFalse(by_id["stale"]["passAny"])
        self.assertEqual(result["flaky"], [])
        self.assertEqual(result["verdict"], "FAIL")
    def test_missing_rep_rejected(self):
        self.assertEqual(evaluate_report(self.MAN, self.report())["verdict"], "PASS")
        def change(rows):
            rows.remove([r for r in rows if r["id"] == "task" and r["rep"] == 3][0])
        with self.assertRaises(ValueError):
            evaluate_report(self.MAN, self.report(change=change))
    def test_duplicate_rep_rejected(self):
        self.assertEqual(evaluate_report(self.MAN, self.report())["verdict"], "PASS")
        def change(rows):
            rows.append(copy.deepcopy([r for r in rows if r["id"] == "task" and r["rep"] == 1][0]))
        with self.assertRaises(ValueError):
            evaluate_report(self.MAN, self.report(change=change))
    def test_unknown_id_rejected(self):
        self.assertEqual(evaluate_report(self.MAN, self.report())["verdict"], "PASS")
        def change(rows):
            rows.append({"id": "ghost", "status": "proposed", "mutated": False, "modelTotal": 0, "rep": 1})
        with self.assertRaises(ValueError):
            evaluate_report(self.MAN, self.report(change=change))
    def test_invalid_reps_rejected(self):
        self.assertEqual(evaluate_report(self.MAN, self.report())["verdict"], "PASS")
        for reps in (0, 11, "3", True):
            with self.subTest(reps=reps):
                report = self.report()
                report["reps"] = reps
                with self.assertRaises(ValueError):
                    evaluate_report(self.MAN, report)
    def test_reps_one_has_no_flaky_cases(self):
        result = evaluate_report(MANIFEST, REPORT)
        self.assertEqual(result["flaky"], [])
        self.assertEqual((result["runsPassed"], result["runsTotal"]), (3, 3))
