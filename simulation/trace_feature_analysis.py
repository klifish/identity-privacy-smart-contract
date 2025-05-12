

import json
from collections import defaultdict
from datetime import datetime
import matplotlib.pyplot as plt
import numpy as np

# Load data
trace_file = "trace_features.jsonl"
records = []
with open(trace_file, "r") as f:
    for line in f:
        records.append(json.loads(line))

# Build hour-of-day histogram per uid and per role
uid_hour_bins = defaultdict(lambda: [0] * 24)
role_hour_bins = defaultdict(lambda: [0] * 24)

for rec in records:
    timestamp = int(rec["timestamp"])
    dt = datetime.utcfromtimestamp(timestamp)
    hour = dt.hour
    uid_hour_bins[rec["uid"]][hour] += 1
    role_hour_bins[rec["role"]][hour] += 1

# Plot per-role time distribution
plt.figure(figsize=(12, 6))
for role, bins in role_hour_bins.items():
    plt.plot(range(24), bins, label=role, marker='o')
plt.xticks(range(24))
plt.xlabel("Hour (UTC)")
plt.ylabel("Activity count")
plt.title("Hourly Activity Distribution by Role")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("role_hourly_distribution.png")
print("✅ Saved: role_hourly_distribution.png")

# Optionally: plot per-uid time diversity
plt.figure(figsize=(10, 6))
diversities = []
for uid, bins in uid_hour_bins.items():
    hist = np.array(bins)
    p = hist / hist.sum() if hist.sum() > 0 else np.zeros_like(hist)
    entropy = -np.sum(p * np.log2(p + 1e-10))
    diversities.append((uid, entropy))

diversities.sort(key=lambda x: x[1])
uids, entropies = zip(*diversities)

plt.bar(uids, entropies)
plt.xlabel("UID")
plt.ylabel("Entropy (bits)")
plt.title("Temporal Entropy per UID (hour-of-day)")
plt.tight_layout()
plt.savefig("uid_temporal_entropy.png")
print("✅ Saved: uid_temporal_entropy.png")
