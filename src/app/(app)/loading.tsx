export default function Loading() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-2xl border border-line bg-surface"
        />
      ))}
    </div>
  );
}
