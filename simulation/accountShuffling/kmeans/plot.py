import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE

# Load KMeans clustering result
with open("clusterResultKMeans.json") as f:
    data = json.load(f)

# Extract features and cluster labels
X = np.array([entry["vector"] for entry in data])
y = np.array([entry["cluster"] for entry in data])

# Apply t-SNE for dimensionality reduction
X_embedded = TSNE(n_components=2, random_state=42).fit_transform(X)

# Plot the results
plt.figure(figsize=(10, 7))
scatter = plt.scatter(X_embedded[:, 0], X_embedded[:, 1], c=y, cmap='tab10', s=30, alpha=0.7)
plt.colorbar(scatter, label="Cluster ID")
plt.title("KMeans Clustering Result (t-SNE Projection)")
plt.grid(True)
plt.tight_layout()
plt.savefig("clusterKMeans_tsne.png")
plt.show()
