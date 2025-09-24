from collections import defaultdict
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
import json
import numpy as np
from sklearn.cluster import KMeans

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

with open("../role_merged_wallets.json") as f:
    merged_data = json.load(f)

mismatch_count = 0
for entry in merged_data:
    merged_role = entry["role"]
    for addr_entry in entry["addresses"]:
        addr = addr_entry["smartAccountAddress"].lower()
        original_role = address_to_role.get(addr)
        if original_role != merged_role:
            print(
                f"❌ Role mismatch for {addr}: address_to_role={original_role}, role_merged_wallets={merged_role}")
            mismatch_count += 1

print(f"🔍 Role comparison complete. Mismatches found: {mismatch_count}")

# Load features
with open("../addressFeatures.json") as f:
    raw_data = json.load(f)

features = []
address_list = []

for address, feat in raw_data.items():
    if address.lower() not in address_to_role:
        continue  # skip unlabelled/noise addresses
    address_list.append(address)
    features.append([
        feat["n_tx"],
        feat["duration"],
        feat["mean_time_gap"],
        feat["std_time_gap"],
        *feat["activity_vector"]
    ])


features = np.array(features)

# Export features and addresses to JSON
features_for_export = [
    {"address": address, "feature": feature.tolist()}
    for address, feature in zip(address_list, features)
]
with open("kmeans_features.json", "w") as f:
    json.dump(features_for_export, f, indent=2)
print("📁 Features saved to kmeans_features.json")



print(
    f"🔍 Feature extraction complete. Number of addresses: {len(address_list)}")

# --- Supervised evaluation using true role labels ---
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

# Export clustering result for the best k
best_k = max(results_by_k, key=lambda x: results_by_k[x][0])  # use ARI to select best k
kmeans = KMeans(n_clusters=best_k, random_state=42).fit(features)
labels = kmeans.labels_

clustering_result = []
for i, address in enumerate(address_list):
    clustering_result.append({
        "address": address,
        "cluster": int(labels[i]),
        "role": address_to_role.get(address.lower())
    })

with open("kmeans_cluster_result.json", "w") as f:
    json.dump(clustering_result, f, indent=2)
print(f"📁 Cluster assignments for K={best_k} saved to kmeans_cluster_result.json")
