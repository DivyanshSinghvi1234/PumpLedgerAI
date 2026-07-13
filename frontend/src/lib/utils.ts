import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

/** Format a number as Indian Rupees, e.g. 1234.5 -> "₹1,234.50". */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value ?? 0)
}
