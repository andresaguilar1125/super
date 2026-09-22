import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names and resolve Tailwind conflicts.
 *
 * `clsx` handles the conditional/array/object forms; `twMerge` ensures a
 * caller-supplied class always wins over a component default — e.g. passing
 * `class="rounded-sm"` to a component whose base says `rounded-lg`.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
