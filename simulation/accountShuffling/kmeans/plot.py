import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE

# Step 1: Load features and clustering results
with open("../addressFeatures.json") as f:
    raw_data = json.load(f)

with open("kmeans_cluster_result.json") as f:
    cluster_data = json.load(f)

# Step 2: Build feature matrix and cluster labels
X = []
y = []
for entry in cluster_data:
    address = entry["address"]
    if address not in raw_data:
        continue
    feat = raw_data[address]
    X.append([
        feat["n_tx"],
        feat["duration"],
        feat["mean_time_gap"],
        feat["std_time_gap"],
        *feat["activity_vector"]
    ])
    y.append(entry["cluster"])

X = np.array(X)
y = np.array(y)

# Step 3: Dimensionality reduction
n_samples = len(X)
perplexity = min(30, max(2, (n_samples - 1) // 3))
X_embedded = TSNE(n_components=2, random_state=42, perplexity=perplexity).fit_transform(X)

# Step 4: Plot
plt.figure(figsize=(12, 8))
scatter = plt.scatter(
    X_embedded[:, 0], X_embedded[:, 1], c=y, cmap='tab20', s=30, alpha=0.8)
plt.title("KMeans Clustering (t-SNE 2D Projection)")
plt.grid(True)
plt.colorbar(scatter, label="Cluster ID")
plt.tight_layout()
plt.savefig("kmeans_clusters_tsne.png")
plt.close()

print("✅ Cluster visualization saved as kmeans_clusters_tsne.png")
