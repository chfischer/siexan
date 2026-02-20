import urllib.request
import urllib.error
import json

def update_rule(rule_id, pattern):
    url = f"http://127.0.0.1:8000/rules/{rule_id}"
    data = json.dumps({"pattern": pattern}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="PUT")
    try:
        urllib.request.urlopen(req)
        print(f"Rule {rule_id} updated successfully: {pattern}")
    except Exception as e:
        print(f"Error updating rule {rule_id}: {e}")

def recategorize():
    url = "http://127.0.0.1:8000/rules/re-categorize/"
    req = urllib.request.Request(url, method="POST")
    try:
        response = urllib.request.urlopen(req)
        print(f"Recategorization response: {json.loads(response.read().decode('utf-8'))}")
    except Exception as e:
        print(f"Error recategorizing: {e}")

update_rule(1, r"Helena Krakovska;Hintergasse 10; CH Rüschlikon 8803 \| e-banking payment order")
update_rule(26, r"Revolut Bank UAB;\|LT \| Standing order \| Reason for payment: Anna Fischer")
recategorize()
