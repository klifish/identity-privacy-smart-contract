import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
import matplotlib.cm as cm

# 1. Load cluster result data
with open("./clusterResult.json", "r") as f:
    data = json.load(f)

# 2. Extract features and cluster labels
X = np.array([entry["vector"] for entry in data])
y = np.array([entry["cluster"] for entry in data])

# 3. Dimensionality reduction with t-SNE
X_embedded = TSNE(n_components=2, random_state=42).fit_transform(X)

# 4. Plotting
plt.figure(figsize=(12, 8))
unique_clusters = sorted(set(y))
num_clusters = len([c for c in unique_clusters if c != -1])
color_map = plt.get_cmap('tab20', num_clusters)

cluster_index = 0
for cluster_id in unique_clusters:
    mask = y == cluster_id
    if cluster_id == -1:
        plt.scatter(X_embedded[mask, 0], X_embedded[mask, 1], c='black', s=10, label='Noise')
    else:
        plt.scatter(
            X_embedded[mask, 0], X_embedded[mask, 1],
            color=color_map(cluster_index),
            s=30, alpha=0.8, label=f'Cluster {cluster_id}'
        )
        cluster_index += 1

plt.legend(loc='center left', bbox_to_anchor=(1, 0.5), fontsize='small', ncol=1)
plt.tight_layout(rect=[0, 0, 0.8, 1])  # Leave space on the right for legend
plt.title("DBSCAN Clustering Result (t-SNE 2D Projection)")
plt.grid(True)
plt.tight_layout()
plt.savefig("dbscan_clusters_with_noise.png")
plt.close()
