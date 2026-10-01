const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

/** Formats a rupee amount with Indian digit grouping, e.g. 12840 → "₹12,840". */
export function formatINR(amount: number) {
  return inr.format(amount)
}
