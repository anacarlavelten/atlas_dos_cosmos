export function futureLaunches(launches, reference = Date.now()) {
  return (launches || [])
    .filter(launch => {
      if (!launch.net) return true;
      const timestamp = Date.parse(launch.net);
      return Number.isNaN(timestamp) || timestamp >= reference;
    })
    .sort((a, b) => {
      const first = Date.parse(a.net || '');
      const second = Date.parse(b.net || '');
      return (Number.isNaN(first) ? Number.POSITIVE_INFINITY : first)
        - (Number.isNaN(second) ? Number.POSITIVE_INFINITY : second);
    });
}
