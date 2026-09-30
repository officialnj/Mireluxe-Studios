import { revalidatePath } from 'next/cache';

/** Call after any admin write that could affect customer-facing pages. */
export function revalidatePublicPages() {
  revalidatePath('/');
  revalidatePath('/book');
  revalidatePath('/shop');
}
