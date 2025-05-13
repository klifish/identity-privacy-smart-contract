from collections import defaultdict
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
import json
import numpy as np
from sklearn.cluster import KMeans

# Load features
with open("../addressFeatures.json") as f:
    raw_data = json.load(f)

features = []
address_list = []

for address, feat in raw_data.items():
    address_list.append(address)
    features.append([
        feat["n_tx"],
        feat["duration"],
        feat["mean_time_gap"],
        feat["std_time_gap"],
        *feat["activity_vector"]
    ])

features = np.array(features)

# --- Supervised evaluation using true role labels ---

# Load role labels
with open("../../trace_features.jsonl") as f:
    uid_to_role = {}
    for line in f:
        r = json.loads(line)
        if "uid" in r and "role" in r:
            uid_to_role[r["uid"]] = r["role"]

with open("../../wallets_with_shuffling.json") as f:
    wallets = json.load(f)

address_to_role = {}
for w in wallets:
    role = uid_to_role.get(w["index"])
    if "smartAccountAddress" in w:
        address_to_role[w["smartAccountAddress"].lower()] = role
    for a in w.get("accountShuffling", []):
        if "smartAccountAddress" in a:
            address_to_role[a["smartAccountAddress"].lower()] = role

results_by_k = {}
for k in range(3, 7):
    kmeans = KMeans(n_clusters=k, random_state=42).fit(features)
    labels = kmeans.labels_

    # Assign true labels
    role_to_id = {}
    labels_true = []
    labels_pred = []

    for i, address in enumerate(address_list):
        role = address_to_role.get(address.lower())
        if role is None:
            continue
        if role not in role_to_id:
            role_to_id[role] = len(role_to_id)
        labels_true.append(role_to_id[role])
        labels_pred.append(labels[i])

    # Evaluate clustering
    ari = adjusted_rand_score(labels_true, labels_pred)
    nmi = normalized_mutual_info_score(labels_true, labels_pred)
    results_by_k[k] = (ari, nmi)
    print(f"K={k} | ARI: {ari:.4f}, NMI: {nmi:.4f}")

print("✅ KMeans clustering complete. Results exported.")
