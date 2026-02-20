import requests
import json
import time

BASE_URL = "http://localhost:8000"

def verify_priority():
    print("--- Verifying Rule Priority ---")
    
    # 1. Cleanup existing rules for test pattern
    test_pattern = "priority_test_123"
    rules_res = requests.get(f"{BASE_URL}/api/rules/")
    for r in rules_res.json():
        if r['pattern'] == test_pattern:
            requests.delete(f"{BASE_URL}/api/rules/{r['id']}")

    # 2. Get a category for testing
    cat_res = requests.get(f"{BASE_URL}/api/categories/")
    cats = cat_res.json()
    if len(cats) < 2:
        print("Not enough categories for test")
        return
    
    cat1_id = cats[0]['id']
    cat2_id = cats[1]['id']

    # 3. Create Rule B (Priority 10)
    print(f"Creating Rule B (Priority 10, Target: {cats[1]['name']})")
    requests.post(f"{BASE_URL}/api/rules/", json={
        "pattern": test_pattern,
        "priority": 10,
        "target_category_id": cat2_id
    })

    # 4. Create Rule A (Priority 5) - Should win
    print(f"Creating Rule A (Priority 5, Target: {cats[0]['name']})")
    requests.post(f"{BASE_URL}/api/rules/", json={
        "pattern": test_pattern,
        "priority": 5,
        "target_category_id": cat1_id
    })

    # 5. Fetch a transaction and set its description
    tx_res = requests.get(f"{BASE_URL}/api/transactions/")
    if not tx_res.json():
        print("No transactions to test with")
        return
    
    tx = tx_res.json()[0]
    requests.patch(f"{BASE_URL}/api/transactions/{tx['id']}", json={"description": test_pattern, "is_manual": 0})

    # 6. Trigger re-categorization
    recat_res = requests.post(f"{BASE_URL}/api/rules/re-categorize/")
    print(f"Re-categorization: {recat_res.json()['message']}")

    # 7. Check result
    final_tx = requests.get(f"{BASE_URL}/api/transactions/").json()[0]
    matched_cat_id = final_tx['category_id']
    
    if matched_cat_id == cat1_id:
        print("SUCCESS: Rule A (Priority 5) took precedence over Rule B (Priority 10)")
    elif matched_cat_id == cat2_id:
        print("FAILURE: Rule B (Priority 10) took precedence")
    else:
        print(f"FAILED: No match or unexpected match (Cat ID: {matched_cat_id})")

    # 8. Swap Priority and verify
    print("\n--- Swapping Priority ---")
    # Rule B -> 2
    # Rule A -> 5 (stays)
    rules = requests.get(f"{BASE_URL}/api/rules/").json()
    rule_b = next(r for r in rules if r['priority'] == 10)
    requests.put(f"{BASE_URL}/api/rules/{rule_b['id']}", json={"priority": 2})
    
    requests.post(f"{BASE_URL}/api/rules/re-categorize/")
    final_tx = requests.get(f"{BASE_URL}/api/transactions/").json()[0]
    
    if final_tx['category_id'] == cat2_id:
        print("SUCCESS: Rule B (now Priority 2) now takes precedence")
    else:
        print("FAILURE: Priority swap didn't work")

if __name__ == "__main__":
    verify_priority()
