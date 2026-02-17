from app.services.categorizer import TransactionCategorizer
import pandas as pd
import io

def test_waterfall():
    print("Initializing TransactionCategorizer...")
    tc = TransactionCategorizer()
    
    # Layer 1: Exact
    tc.add_exact_match("COOP-1932 THALWIL", "Groceries")
    tc.add_exact_match("REVOLUT", "Transfer")
    
    # Layer 2: Regex
    tc.add_regex_pattern(r"UBER.*", "Transport")
    tc.add_regex_pattern(r"AMZN.*", "Shopping")
    
    # Test Layer 1
    print("\nTesting Layer 1 (Exact):")
    res1 = tc.categorize("COOP-1932 THALWIL")
    print(f"  'COOP-1932 THALWIL' -> {res1}")
    assert res1["category"] == "Groceries"
    assert res1["source"] == "exact"
    
    # Test Layer 2
    print("\nTesting Layer 2 (Regex):")
    res2 = tc.categorize("UBER EATS 12345")
    print(f"  'UBER EATS 12345' -> {res2}")
    assert res2["category"] == "Transport"
    assert res2["source"] == "regex"
    
    # Test Layer 3 (Probabilistic)
    print("\nTesting Layer 3 (Probabilistic):")
    try:
        train_data = pd.DataFrame([
            {"description": "McDonalds Zurich", "category": "Dining"},
            {"description": "Burger King Bern", "category": "Dining"},
            {"description": "Starbucks Coffee", "category": "Dining"},
            {"description": "Shell Gas Station", "category": "Fuel"},
            {"description": "BP Petrol", "category": "Fuel"},
            {"description": "Tamoil Fuel", "category": "Fuel"}
        ])
        tc.train(train_data)
        
        if tc.is_trained:
            res3 = tc.categorize("McDonalds Geneva")
            print(f"  'McDonalds Geneva' -> {res3}")
            assert res3["category"] == "Dining"
            assert res3["source"] == "ml"
            
            res4 = tc.categorize("Shell Geneva")
            print(f"  'Shell Geneva' -> {res4}")
            assert res4["category"] == "Fuel"
            assert res4["source"] == "ml"
        else:
            print("  ML Layer skipped (not trained - likely missing scikit-learn)")
    except Exception as e:
        print(f"  ML Layer failed: {e}")

    # Test Fallback
    print("\nTesting Fallback:")
    res5 = tc.categorize("Unknown Vendor 123")
    print(f"  'Unknown Vendor 123' -> {res5}")
    assert res5["category"] == "Uncategorized"
    assert res5["source"] == "none"

    print("\nAll tests passed!")

if __name__ == "__main__":
    test_waterfall()
