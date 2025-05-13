

import json
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score

# Load clustering results
with open("./clusterResult.json") as f:
    cluster_data = json.load(f)

# Load wallets
with open("../../wallets_with_shuffling.json") as f:
    wallets = json.load(f)

# Load uid => role mapping from trace_features
uid_to_role = {}
with open("../../trace_features.jsonl", "r") as f:
    for line in f:
        record = json.loads(line)
        if record.get("uid") is not None and record.get("role"):
            uid_to_role[record["uid"]] = record["role"]

# Build address => role mapping
address_to_role = {}
for wallet in wallets:
    role = uid_to_role.get(wallet["index"])
    if "smartAccountAddress" in wallet:
        address_to_role[wallet["smartAccountAddress"].lower()] = role
    for shuff in wallet.get("accountShuffling", []):
        if "smartAccountAddress" in shuff:
            address_to_role[shuff["smartAccountAddress"].lower()] = role

# Attach ground truth role to cluster result
labels_true = []
labels_pred = []

# Map role names to integer ids
role_to_id = {}
next_id = 0

for entry in cluster_data:
    addr = entry["address"].lower()
    if addr in address_to_role:
        role = address_to_role[addr]
        if role not in role_to_id:
            role_to_id[role] = next_id
            next_id += 1
        labels_true.append(role_to_id[role])
        labels_pred.append(entry["cluster"])

# Compute metrics
ari = adjusted_rand_score(labels_true, labels_pred)
nmi = normalized_mutual_info_score(labels_true, labels_pred)

print(f"Adjusted Rand Index (ARI): {ari:.4f}")
print(f"Normalized Mutual Information (NMI): {nmi:.4f}")
