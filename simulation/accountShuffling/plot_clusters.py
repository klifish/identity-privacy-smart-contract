import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE

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
scatter = plt.scatter(
    X_embedded[:, 0], X_embedded[:, 1], c=y, cmap='tab20', s=30, alpha=0.8)
plt.colorbar(scatter, label="Cluster ID")
plt.title("DBSCAN Clustering Result (t-SNE 2D Projection)")
plt.grid(True)
plt.tight_layout()
plt.show()
