import json
import urllib.request

test_cases = [
    ("TCS", 1), ("TCS", 5), ("TCS", 20),
    ("RELIANCE", 1), ("RELIANCE", 5), ("RELIANCE", 20),
    ("INFY", 1), ("INFY", 5), ("INFY", 20),
    ("AAPL", 1), ("AAPL", 5), ("AAPL", 20),
]

for sym, h in test_cases:
    payload = json.dumps({"symbol": sym, "horizon": h, "model": "LSTM"}).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:8000/api/v1/predictions/stock",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    resp = urllib.request.urlopen(req)
    res = json.loads(resp.read().decode("utf-8"))
    print(f"{sym} h={h} LSTM live: price={res['predicted_value']} return={res['predicted_return']}% dir={res['direction']} model={res['model_name']} v={res['model_version']}")
