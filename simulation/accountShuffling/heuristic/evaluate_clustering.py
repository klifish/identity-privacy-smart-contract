

import json
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
from collections import defaultdict

# === Step 1: Load clustering result ===
with open("role_senders.json") as f:
    predicted_clusters = json.load(f)

# === Step 2: Load ground truth ===
with open("../role_merged_wallets.json") as f:
    role_entries = json.load(f)

true_groups = []
for entry in role_entries:
    addrs = [a["smartAccountAddress"].lower() for a in entry["addresses"]]
    true_groups.append(addrs)

# === Step 3: Build address index ===
address_set = set()
for group in true_groups:
    address_set.update(group)
for group in predicted_clusters.values():
    address_set.update([a.lower() for a in group])

address_list = sorted(address_set)
addr_to_idx = {addr: i for i, addr in enumerate(address_list)}

# === Step 4: Generate label vectors ===
y_true = [None] * len(address_list)
y_pred = [None] * len(address_list)

for label, group in enumerate(true_groups):
    for addr in group:
        y_true[addr_to_idx[addr]] = label

for label, group in enumerate(predicted_clusters.values()):
    for addr in group:
        y_pred[addr_to_idx[addr.lower()]] = label

y_true = [y if y is not None else -1 for y in y_true]
y_pred = [y if y is not None else -1 for y in y_pred]

# === Step 5: Evaluate ===
ari = adjusted_rand_score(y_true, y_pred)
nmi = normalized_mutual_info_score(y_true, y_pred)

print(f"Adjusted Rand Index (ARI): {ari:.4f}")
print(f"Normalized Mutual Information (NMI): {nmi:.4f}")

# === Step 6: Coverage Analysis ===
covered_addrs = set().union(*[set(group) for group in predicted_clusters.values()])
gt_addrs = set().union(*true_groups)

coverage = len(covered_addrs & gt_addrs) / len(gt_addrs)
print(f"Coverage of ground truth addresses: {coverage:.2%}")

# Per-user group coverage
for i, gt_group in enumerate(true_groups):
    overlap = set(gt_group) & covered_addrs
    print(f"User {i}: covered {len(overlap)}/{len(gt_group)} addresses")
