import { stopAndReport } from "./lib/actions";

export default async function Command() {
  await stopAndReport();
}
