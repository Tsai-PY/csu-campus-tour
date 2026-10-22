/**
 * 正修科技大學 校園路網導航與路徑規劃演算法 (Dijkstra)
 */

class CampusPathfinder {
  constructor(data) {
    this.nodes = new Map();
    this.edges = [];
    this.buildingToNode = data.buildingToNode;
    this.initGraph(data.navNodes, data.navEdges);
  }

  initGraph(nodes, edges) {
    nodes.forEach(node => {
      this.nodes.set(node.id, {
        id: node.id,
        name: node.name,
        pos: new THREE.Vector3(node.pos[0], node.pos[1], node.pos[2]),
        neighbors: []
      });
    });

    edges.forEach(([u, v]) => {
      const nodeU = this.nodes.get(u);
      const nodeV = this.nodes.get(v);
      if (nodeU && nodeV) {
        const dist = nodeU.pos.distanceTo(nodeV.pos);
        nodeU.neighbors.push({ node: nodeV, dist });
        nodeV.neighbors.push({ node: nodeU, dist });
      }
    });
  }

  /**
   * 使用 Dijkstra 演算法計算兩建築物間最短步行路徑
   */
  findPathBetweenBuildings(fromBuildingId, toBuildingId) {
    const startNodeId = this.buildingToNode[fromBuildingId];
    const endNodeId = this.buildingToNode[toBuildingId];

    if (!startNodeId || !endNodeId) {
      console.warn("無法找到建築對應的路網節點:", fromBuildingId, toBuildingId);
      return null;
    }

    if (startNodeId === endNodeId) {
      const node = this.nodes.get(startNodeId);
      return {
        path: [node.pos.clone()],
        nodeIds: [startNodeId],
        distanceMeters: 20,
        walkingMinutes: 1
      };
    }

    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set();

    this.nodes.forEach((_, id) => {
      distances.set(id, Infinity);
      unvisited.add(id);
    });

    distances.set(startNodeId, 0);

    while (unvisited.size > 0) {
      // 找出距離最小的未造訪節點
      let currentId = null;
      let smallestDist = Infinity;
      unvisited.forEach(id => {
        const d = distances.get(id);
        if (d < smallestDist) {
          smallestDist = d;
          currentId = id;
        }
      });

      if (currentId === null || smallestDist === Infinity) break;
      if (currentId === endNodeId) break;

      unvisited.delete(currentId);
      const currentNode = this.nodes.get(currentId);

      currentNode.neighbors.forEach(({ node: neighborNode, dist }) => {
        if (unvisited.has(neighborNode.id)) {
          const alt = smallestDist + dist;
          if (alt < distances.get(neighborNode.id)) {
            distances.set(neighborNode.id, alt);
            previous.set(neighborNode.id, currentId);
          }
        }
      });
    }

    // 重構路徑
    const pathNodeIds = [];
    let curr = endNodeId;
    while (curr) {
      pathNodeIds.unshift(curr);
      curr = previous.get(curr);
    }

    if (pathNodeIds[0] !== startNodeId) {
      return null; // 無法連通
    }

    // 換算距離 (單位模擬約 1.5 公尺/單位)
    const rawDistance = distances.get(endNodeId);
    const distanceMeters = Math.round(rawDistance * 1.6);
    const walkingMinutes = Math.max(1, Math.round(distanceMeters / 70)); // 步行速度約每分 70 公尺

    const points = pathNodeIds.map(id => this.nodes.get(id).pos.clone());

    return {
      nodeIds: pathNodeIds,
      points: points,
      distanceMeters,
      walkingMinutes
    };
  }
}
