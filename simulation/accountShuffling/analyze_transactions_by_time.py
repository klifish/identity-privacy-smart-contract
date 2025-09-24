import json
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime

# 1. Load enrichedTransactions.json
with open('enrichedTransactions.json', 'r') as f:
    transactions = json.load(f)

print(f"Loaded {len(transactions)} transactions.")

# 2. Extract timestamps and convert to DataFrame
df = pd.DataFrame(transactions)
print(f"DataFrame shape: {df.shape}")
print(f"DataFrame columns: {df.columns.tolist()}")
print(f"DataFrame head:\n{df.head()}")

df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')  # Convert to datetime format
df.set_index('datetime', inplace=True)

print(f"DataFrame shape: {df.shape}")
print(f"DataFrame columns: {df.columns.tolist()}")
print(f"DataFrame head:\n{df.head()}")

# Load role mapping
with open("../trace_features.jsonl") as f:
    uid_to_role = {}
    for line in f:
        r = json.loads(line)
        if "uid" in r and "role" in r:
            uid_to_role[r["uid"]] = r["role"]

with open("../wallets_with_shuffling.json") as f:
    wallets = json.load(f)

address_to_role = {}
for w in wallets:
    role = uid_to_role.get(w["index"])
    if "smartAccountAddress" in w:
        address_to_role[w["smartAccountAddress"].lower()] = role
    for a in w.get("accountShuffling", []):
        if "smartAccountAddress" in a:
            address_to_role[a["smartAccountAddress"].lower()] = role

# Add role column
df['from_lower'] = df['result'].apply(lambda x: x.get('from', '').lower())
df['role'] = df['from_lower'].map(address_to_role)
print(f"Role value counts:\n{df['role'].value_counts()}")

# 3. Count transactions per minute
minute_counts = df.resample('T').size()
print(f"Minute counts:\n{minute_counts.head()}")
print(f"Minute counts shape: {minute_counts.shape}")

# 4. Visualize transaction counts per minute
plt.figure(figsize=(12, 6))
minute_counts.plot()
plt.title('Minute Transaction Count')
plt.xlabel('Datetime (minute)')
plt.ylabel('Number of Transactions')
plt.grid(True)
plt.tight_layout()
plt.savefig("minute_transaction_count.png")

plt.show()
