// Intentionally faulty demo service. Kineframe edits an isolated copy.
export function createCheckout(pool, charge) {
  return async function checkout(declined) {
    const connection = pool.acquire();
    const receipt = await charge(declined);
    pool.release(connection);
    return { order: "confirmed", receipt };
  };
}
