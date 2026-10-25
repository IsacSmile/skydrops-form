/**
 * Moves an item in an array up or down by one position.
 * Pure function: does not mutate the input array.
 * If the move is invalid (e.g. moving the first item up, or the last item down,
 * or out-of-bounds index), it returns a shallow copy of the original array.
 */
export function moveItem<T>(
  items: readonly T[],
  index: number,
  direction: "up" | "down"
): T[] {
  const result = [...items];
  if (items.length <= 1) {
    return result;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length || index < 0 || index >= items.length) {
    return result;
  }

  const [removed] = result.splice(index, 1);
  result.splice(targetIndex, 0, removed);
  return result;
}
