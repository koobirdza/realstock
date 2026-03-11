export function collectRecords(node, inputRows, meta) {
  const items = Array.isArray(node?.items) ? node.items : [];

  return inputRows
    .filter((r) => Number(r.value) > 0 && items[r.index])
    .map((r) => {
      const item = items[r.index];
      return {
        employee: meta.employee,
        action: meta.mode,
        category: item.target_category,
        main_category: item.main_category,
        sub_category: item.sub_category,
        item_key: item.item_key,
        item_name: item.item_name,
        brand: item.brand,
        qty: Number(r.value),
        unit: item.unit,
        item_type: item.item_type,
        note: "",
        from_category: meta.mode === "issue" ? "ห้องสต๊อก" : "",
        to_category: meta.mode === "issue" ? (meta.destination || "") : ""
      };
    });
}
