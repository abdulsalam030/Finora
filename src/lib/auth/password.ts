import bcrypt from "bcryptjs";

const COST = 12;

export const hashSecret = (plain: string) => bcrypt.hash(plain, COST);
export const verifySecret = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Used when the account doesn't exist, so a failed login takes as long as a wrong password.
let dummyHash: Promise<string> | undefined;
export async function burnTime(plain: string) {
  dummyHash ??= bcrypt.hash("timing-equaliser", COST);
  await bcrypt.compare(plain, await dummyHash);
}
