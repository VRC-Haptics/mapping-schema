export default {
  from: "v0.0.0",
  to: "v0.0.1",
  requiresUserInput: false,

  async gather(old, ctx) {
    ctx.log("Starting v0.0.0 -> v0.0.1");

    const vrcPrefix = "/avatar/parameters/Haptics/Nodes/";
    ctx.set("vrcPrefix", vrcPrefix);

    const processedNodes = old.nodes.map((node) => {
      const fullAddress = node.address;
      const shortAddress = fullAddress.startsWith(vrcPrefix)
        ? fullAddress.slice(vrcPrefix.length)
        : fullAddress;

      const bone =
        node.target_bone.charAt(0).toLowerCase() + node.target_bone.slice(1);

      return {
        location: [node.node_data.x, node.node_data.y, node.node_data.z],
        groups: node.node_data.groups,
        shortAddress,
        fullAddress,
        externalSource: node.is_external_address,
        parentBone: bone,
        sphereRadius: node.radius,
        rayLen: node.ray.size,
        rayOffset: node.ray.position_offset.z,
      };
    });

    ctx.set("nodes", processedNodes);
    ctx.set("meta", old.meta);
  },

  async migrate(old, ctx) {
    const vrcPrefix = ctx.get("vrcPrefix");
    const nodes = ctx.get("nodes");
    const meta = ctx.get("meta");

    const RAY_EPSILON = 0.0001;

    return {
      identification: {
        author_name: meta.map_author,
        map_name: meta.map_name,
        map_version: meta.map_version,
      },
      nodes: nodes.map((n) => {
        const inputs = [
          {
            address: n.shortAddress,
            vrcPrefix: vrcPrefix,
            externalSource: n.externalSource,
            source: "weight",
            layer: "additive",
            weight: 1.0,
            shape: {
              type: "sphere",
              radius: n.sphereRadius,
            },
          },
        ];

        if (n.rayLen > RAY_EPSILON) {
          inputs.push({
            address: n.shortAddress + "_Ratio",
            vrcPrefix: vrcPrefix,
            externalSource: n.externalSource,
            source: "weight",
            layer: "additive",
            weight: 1.0,
            shape: {
              type: "ray",
              len: n.rayLen,
              offset: n.rayOffset,
            },
          });
        } else {
          inputs.push({
            address: n.shortAddress,
            vrcPrefix: vrcPrefix,
            externalSource: n.externalSource,
            source: "velocity",
            layer: "additive",
            weight: 1.0,
            shape: {
              type: "sphere",
              radius: n.sphereRadius,
            },
          });
        }

        return {
          location: n.location,
          interactionTags: n.groups,
          parentBone: n.parentBone,
          interpolationLayer: "default",
          radius: n.sphereRadius,
          inputs,
        };
      }),
    };
  },
};
