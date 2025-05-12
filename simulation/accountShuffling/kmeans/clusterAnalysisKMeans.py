

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

# Apply KMeans clustering
features = np.array(features)
kmeans = KMeans(n_clusters=10, random_state=42).fit(features)
labels = kmeans.labels_

# Output summary
with open("./clusterSummaryKMeans.txt", "w") as f:
    for i in range(10):
        cluster_indices = [idx for idx,
                           label in enumerate(labels) if label == i]
        f.write(f"Cluster {i} ({len(cluster_indices)} addresses):\n")
        for idx in cluster_indices:
            f.write(f"  {address_list[idx]}\n")

# Output full result for evaluation
results = []
for idx, label in enumerate(labels):
    results.append({
        "address": address_list[idx],
        "cluster": int(label),
        "vector": features[idx].tolist()
    })

with open("./clusterResultKMeans.json", "w") as f:
    json.dump(results, f, indent=2)

print("✅ KMeans clustering complete. Results exported.")
