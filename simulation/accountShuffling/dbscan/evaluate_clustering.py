

import json
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score

# Load clustering results
with open("./kmeans/clusterResultKMeans.json") as f:
    cluster_data = json.load(f)

# Load ground truth (wallets)
with open("../wallets_with_shuffling.json") as f:
    wallets = json.load(f)

# Build address => uid mapping
address_to_uid = {}
for i, wallet in enumerate(wallets):
    if "smartAccountAddress" in wallet:
        address_to_uid[wallet["smartAccountAddress"].lower()] = i
    for shuff in wallet.get("accountShuffling", []):
        if "smartAccountAddress" in shuff:
            address_to_uid[shuff["smartAccountAddress"].lower()] = i

# Attach ground truth uid to cluster result
labels_true = []
labels_pred = []

for entry in cluster_data:
    addr = entry["address"].lower()
    if addr in address_to_uid:
        labels_true.append(address_to_uid[addr])
        labels_pred.append(entry["cluster"])

# Compute metrics
ari = adjusted_rand_score(labels_true, labels_pred)
nmi = normalized_mutual_info_score(labels_true, labels_pred)

print(f"Adjusted Rand Index (ARI): {ari:.4f}")
print(f"Normalized Mutual Information (NMI): {nmi:.4f}")
