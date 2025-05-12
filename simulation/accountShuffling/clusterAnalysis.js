

const clustering = require("density-clustering");
const fs = require("fs");
const path = require("path");
const rawData = JSON.parse(fs.readFileSync(path.join(__dirname, "addressFeatures.json"), "utf-8"));

const features = [];
const addressList = [];

for (const [address, feat] of Object.entries(rawData)) {
    addressList.push(address);
    features.push([
        feat.n_tx,
        feat.duration,
        feat.mean_time_gap,
        feat.std_time_gap,
        ...feat.activity_vector
    ]);
}

const dbscan = new clustering.DBSCAN();
const clusters = dbscan.run(features, 5, 2); // eps=0.5, minPts=2 (tunable)
const noise = dbscan.noise;

const summaryLines = [];

clusters.forEach((cluster, i) => {
    summaryLines.push(`Cluster ${i} (${cluster.length} addresses):`);
    cluster.forEach(index => {
        summaryLines.push(`  ${addressList[index]}`);
    });
});

summaryLines.push(`\nNoise (${noise.length} addresses):`);
noise.forEach(index => {
    summaryLines.push(`  ${addressList[index]}`);
});

fs.writeFileSync(path.join(__dirname, "clusterSummary.txt"), summaryLines.join("\n"));
console.log("✅ Cluster summary exported to clusterSummary.txt");

// Export clustering result to clusterResult.json
const result = [];

clusters.forEach((cluster, clusterIndex) => {
    cluster.forEach(index => {
        result.push({
            address: addressList[index],
            cluster: clusterIndex,
            vector: features[index]
        });
    });
});

noise.forEach(index => {
    result.push({
        address: addressList[index],
        cluster: -1,
        vector: features[index]
    });
});

fs.writeFileSync(path.join(__dirname, "clusterResult.json"), JSON.stringify(result, null, 2));
console.log("✅ Cluster results exported to clusterResult.json");